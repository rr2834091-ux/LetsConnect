from rest_framework import generics, permissions, status, exceptions
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db import transaction
from django.db.models import Q
from .models import (
    PersonalProfile,
    PersonalCommunity,
    PersonalCommunityMembership,
    PersonalCommunityChannel,
    PersonalChannelMembership
)
from .serializers import (
    PersonalProfileSerializer,
    PersonalCommunitySerializer,
    PersonalCommunityChannelSerializer,
    PersonalCommunityMembershipSerializer
)
from apps.messaging.models import Conversation

class PersonalProfileView(generics.RetrieveUpdateAPIView):
    """
    Get or update the active user's isolated personal profile.
    """
    serializer_class = PersonalProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        profile, _ = PersonalProfile.objects.get_or_create(
            user=self.request.user,
            defaults={
                'display_name': f"{self.request.user.first_name} {self.request.user.last_name}".strip() or self.request.user.username
            }
        )
        return profile


class PersonalCommunityListCreateView(generics.ListCreateAPIView):
    """
    List user's personal communities or create a new community.
    """
    serializer_class = PersonalCommunitySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        my_community_ids = PersonalCommunityMembership.objects.filter(
            user=user
        ).values_list('community_id', flat=True)

        return PersonalCommunity.objects.filter(
            Q(id__in=my_community_ids) | Q(is_private=False)
        ).distinct().order_by('-created_at')

    def create(self, request, *args, **kwargs):
        name = request.data.get('name', '').strip()
        description = request.data.get('description', '').strip()
        is_private = request.data.get('is_private', False)
        join_policy = request.data.get('join_policy', 'open')

        if not name:
            return Response({"detail": "Community name is required."}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            community = PersonalCommunity.objects.create(
                name=name,
                description=description,
                owner=request.user,
                is_private=is_private,
                join_policy=join_policy
            )

            # Owner membership
            PersonalCommunityMembership.objects.create(
                community=community,
                user=request.user,
                role='owner'
            )

            # Default #general channel
            general_channel = PersonalCommunityChannel.objects.create(
                community=community,
                name="general",
                description="General discussion",
                channel_type="text",
                created_by=request.user
            )

            # Backing conversation in Messaging (personal context, organization=None)
            from apps.messaging.models import ConversationParticipant
            conv = Conversation.objects.create(
                conversation_type='channel',
                organization=None,
                community=community,
                community_channel=general_channel,
                title=f"#{general_channel.name}",
                created_by=request.user
            )
            ConversationParticipant.objects.get_or_create(conversation=conv, user=request.user, defaults={'role': 'owner'})

            serializer = self.get_serializer(community, context={'request': request})
            return Response(serializer.data, status=status.HTTP_201_CREATED)


class PersonalCommunityDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = PersonalCommunitySerializer
    permission_classes = [permissions.IsAuthenticated]
    lookup_field = 'id'

    def get_queryset(self):
        return PersonalCommunity.objects.all()

    def perform_destroy(self, instance):
        if instance.owner != self.request.user:
            raise exceptions.PermissionDenied("Only the community owner can delete this community.")
        instance.delete()


class PersonalCommunityJoinView(APIView):
    """
    Join a personal community using its invite_code or ID.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        invite_code = request.data.get('invite_code', '').strip()
        community_id = request.data.get('community_id', '').strip()

        community = None
        if invite_code:
            community = PersonalCommunity.objects.filter(invite_code__iexact=invite_code).first()
        elif community_id:
            community = PersonalCommunity.objects.filter(id=community_id).first()

        if not community:
            return Response({"detail": "Community not found. Please check invite code or ID."}, status=status.HTTP_404_NOT_FOUND)

        membership, created = PersonalCommunityMembership.objects.get_or_create(
            community=community,
            user=request.user,
            defaults={'role': 'member'}
        )

        serializer = PersonalCommunitySerializer(community, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK if not created else status.HTTP_201_CREATED)


class PersonalCommunityChannelListCreateView(generics.ListCreateAPIView):
    """
    List channels in a personal community or create a new one.
    """
    serializer_class = PersonalCommunityChannelSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        community_id = self.request.query_params.get('community_id')
        if not community_id:
            raise exceptions.ValidationError({"detail": "community_id query parameter is required."})

        user = self.request.user
        is_member = PersonalCommunityMembership.objects.filter(community_id=community_id, user=user).exists()
        if not is_member:
            raise exceptions.PermissionDenied("You must be a member of this community to view its channels.")

        return PersonalCommunityChannel.objects.filter(community_id=community_id).order_by('created_at')

    def create(self, request, *args, **kwargs):
        community_id = request.data.get('community_id')
        name = request.data.get('name', '').strip()
        channel_type = request.data.get('channel_type', 'text')
        description = request.data.get('description', '').strip()
        is_private = request.data.get('is_private', False)

        if not community_id or not name:
            return Response({"detail": "community_id and name are required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            community = PersonalCommunity.objects.get(id=community_id)
        except PersonalCommunity.DoesNotExist:
            return Response({"detail": "Community not found."}, status=status.HTTP_404_NOT_FOUND)

        # Check membership and permission
        membership = PersonalCommunityMembership.objects.filter(community=community, user=request.user).first()
        if not membership:
            return Response({"detail": "You must be a member of this community to create channels."}, status=status.HTTP_403_FORBIDDEN)

        with transaction.atomic():
            channel = PersonalCommunityChannel.objects.create(
                community=community,
                name=name,
                description=description,
                channel_type=channel_type,
                is_private=is_private,
                created_by=request.user
            )

            # Backing conversation in Messaging (personal context, organization=None)
            from apps.messaging.models import ConversationParticipant
            conv = Conversation.objects.create(
                conversation_type='channel',
                organization=None,
                community=community,
                community_channel=channel,
                title=f"#{channel.name}",
                created_by=request.user
            )
            ConversationParticipant.objects.get_or_create(conversation=conv, user=request.user, defaults={'role': 'owner'})

            if is_private:
                PersonalChannelMembership.objects.create(
                    channel=channel,
                    user=request.user
                )

            serializer = self.get_serializer(channel)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
