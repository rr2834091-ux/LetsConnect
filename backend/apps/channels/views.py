from rest_framework import generics, permissions, status, exceptions
from rest_framework.response import Response
from django.db import transaction
from .models import Channel, ChannelMembership
from .serializers import ChannelSerializer, ChannelMembershipSerializer
from apps.teams.models import Team, TeamMembership
from apps.memberships.models import Employee, AdminProfile
from apps.permissions.evaluator import can_create_channels, is_org_admin, is_team_owner
from apps.messaging.models import Conversation

class ChannelListCreateView(generics.ListCreateAPIView):
    serializer_class = ChannelSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        team_id = self.request.query_params.get('team_id')
        if not team_id:
            raise exceptions.ValidationError({"detail": "team_id query parameter is required."})

        try:
            team = Team.objects.get(id=team_id)
        except Team.DoesNotExist:
            raise exceptions.NotFound("Team not found.")

        user = self.request.user
        # Admins see all channels
        if is_org_admin(user, team.organization_id):
            return Channel.objects.filter(team=team, is_archived=False)

        # Team member check
        emp = Employee.objects.filter(organization=team.organization, email__iexact=user.email).first()
        is_member = TeamMembership.objects.filter(team=team, employee=emp).exists() if emp else False

        if not is_member and team.visibility == 'private':
            raise exceptions.PermissionDenied("You are not a member of this private team.")

        # Filter standard channels + private channels user has access to
        private_accessible_ids = ChannelMembership.objects.filter(
            employee=emp
        ).values_list('channel_id', flat=True) if emp else []

        from django.db.models import Q
        return Channel.objects.filter(
            team=team,
            is_archived=False
        ).filter(
            Q(channel_type='standard') | Q(id__in=private_accessible_ids)
        )

    def create(self, request, *args, **kwargs):
        team_id = request.data.get('team')
        if not team_id:
            return Response({"detail": "team field is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            team = Team.objects.get(id=team_id)
        except Team.DoesNotExist:
            return Response({"detail": "Team not found."}, status=status.HTTP_404_NOT_FOUND)

        if not can_create_channels(request.user, team.id):
            return Response(
                {"detail": "You do not have permission to create channels in this team."},
                status=status.HTTP_403_FORBIDDEN
            )

        with transaction.atomic():
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            channel = serializer.save()

            # Ensure backing conversation exists in LetsConnect
            Conversation.objects.get_or_create(
                conversation_type='channel',
                channel=channel,
                defaults={
                    'organization_id': team.organization_id,
                    'title': f"#{channel.name}",
                    'created_by': request.user
                }
            )

            # If private channel, add creator as owner
            if channel.channel_type == 'private':
                emp = Employee.objects.filter(organization=team.organization, email__iexact=request.user.email).first()
                if emp:
                    ChannelMembership.objects.create(
                        channel=channel,
                        employee=emp,
                        role_in_channel='owner'
                    )

            return Response(serializer.data, status=status.HTTP_201_CREATED)


class ChannelDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ChannelSerializer
    permission_classes = [permissions.IsAuthenticated]
    lookup_field = 'id'

    def get_queryset(self):
        return Channel.objects.all()

    def perform_update(self, serializer):
        channel = serializer.instance
        if not is_team_owner(self.request.user, channel.team_id) and not is_org_admin(self.request.user, channel.team.organization_id):
            raise exceptions.PermissionDenied("Only a team owner or organization admin can edit this channel.")
        serializer.save()

    def perform_destroy(self, instance):
        if instance.name.lower() == 'general':
            raise exceptions.ValidationError({"detail": "The default general channel cannot be deleted."})
        if not is_team_owner(self.request.user, instance.team_id) and not is_org_admin(self.request.user, instance.team.organization_id):
            raise exceptions.PermissionDenied("Only a team owner or organization admin can delete this channel.")
        instance.is_archived = True
        instance.save()
