from rest_framework import generics, permissions, status, exceptions
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from .models import Conversation, ConversationParticipant, Message
from .serializers import ConversationSerializer, MessageSerializer
from apps.organizations.models import Organization
from apps.memberships.models import Employee
from apps.teams.models import Team, TeamMembership
from apps.channels.models import Channel, ChannelMembership

channel_layer = get_channel_layer()

class ConversationListCreateView(generics.ListCreateAPIView):
    serializer_class = ConversationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        org_id = self.request.query_params.get('organization_id') or getattr(self.request, 'active_org_id', None)
        conv_type = self.request.query_params.get('type')

        qs = Conversation.objects.all()

        if org_id:
            # Scoped to organization - verify membership
            from apps.memberships.models import AdminProfile
            is_member = Employee.objects.filter(
                organization_id=org_id,
                email__iexact=user.email,
                status='active'
            ).exists() or AdminProfile.objects.filter(user=user, organization_id=org_id).exists()

            if not is_member:
                return Conversation.objects.none()

            emp = Employee.objects.filter(organization_id=org_id, email__iexact=user.email).first()
            my_team_ids = list(TeamMembership.objects.filter(employee=emp).values_list('team_id', flat=True)) if emp else []

            # Accessible channels: standard channels in user's teams + public teams
            accessible_channel_ids = Channel.objects.filter(
                Q(team_id__in=my_team_ids) | Q(team__visibility='public', team__organization_id=org_id)
            ).values_list('id', flat=True)

            qs = qs.filter(
                Q(organization_id=org_id, channel_id__in=accessible_channel_ids) |
                Q(organization_id=org_id, participants__user=user, participants__is_hidden=False)
            )
        else:
            # Personal context: conversations where user is a participant and not hidden
            qs = qs.filter(organization__isnull=True, participants__user=user, participants__is_hidden=False)

        if conv_type:
            qs = qs.filter(conversation_type=conv_type)

        return qs.distinct().order_by('-updated_at')

    def create(self, request, *args, **kwargs):
        user = request.user
        conv_type = request.data.get('conversation_type', 'direct')
        recipient_id = request.data.get('recipient_id')
        participant_ids = request.data.get('participant_ids', [])
        title = request.data.get('title', '')
        org_id = request.data.get('organization_id') or getattr(request, 'active_org_id', None)

        with transaction.atomic():
            if conv_type == 'direct':
                if not recipient_id:
                    return Response({"detail": "recipient_id is required for direct conversations."}, status=status.HTTP_400_BAD_REQUEST)
                from django.contrib.auth.models import User
                from apps.memberships.models import Employee
                recipient = None
                try:
                    recipient = User.objects.get(id=recipient_id)
                except (User.DoesNotExist, ValueError):
                    emp = Employee.objects.filter(id=recipient_id).first()
                    if emp:
                        recipient = User.objects.filter(email__iexact=emp.email).first()
                    if not recipient:
                        recipient = User.objects.filter(email__iexact=str(recipient_id)).first()

                if not recipient:
                    return Response({"detail": "Recipient not found."}, status=status.HTTP_404_NOT_FOUND)

                # Check if a 1:1 conversation already exists
                existing = Conversation.objects.filter(
                    conversation_type='direct',
                    organization_id=org_id,
                    participants__user=user
                ).filter(participants__user=recipient).first()

                if existing:
                    ConversationParticipant.objects.filter(conversation=existing, user=user).update(is_hidden=False)
                    serializer = self.get_serializer(existing)
                    return Response(serializer.data, status=status.HTTP_200_OK)

                conv = Conversation.objects.create(
                    conversation_type='direct',
                    organization_id=org_id,
                    title=f"{recipient.first_name or recipient.username}",
                    created_by=user
                )
                ConversationParticipant.objects.create(conversation=conv, user=user, role='member')
                ConversationParticipant.objects.create(conversation=conv, user=recipient, role='member')

            elif conv_type == 'group':
                if not title or not str(title).strip():
                    return Response({"detail": "Group name is required."}, status=status.HTTP_400_BAD_REQUEST)
                conv = Conversation.objects.create(
                    conversation_type='group',
                    organization_id=org_id,
                    title=str(title).strip(),
                    created_by=user
                )
                ConversationParticipant.objects.create(conversation=conv, user=user, role='admin')
                from django.contrib.auth.models import User
                from apps.memberships.models import Employee
                for pid in participant_ids:
                    p_user = None
                    try:
                        p_user = User.objects.get(id=pid)
                    except (User.DoesNotExist, ValueError):
                        emp = Employee.objects.filter(id=pid).first()
                        if emp:
                            p_user = User.objects.filter(email__iexact=emp.email).first()
                        if not p_user:
                            p_user = User.objects.filter(email__iexact=str(pid)).first()

                    if p_user and p_user != user:
                        ConversationParticipant.objects.get_or_create(conversation=conv, user=p_user, defaults={'role': 'member'})
            else:
                return Response({"detail": f"Unsupported conversation type for manual creation: {conv_type}"}, status=status.HTTP_400_BAD_REQUEST)

            serializer = self.get_serializer(conv)
            return Response(serializer.data, status=status.HTTP_201_CREATED)


class ConversationDetailView(generics.RetrieveAPIView):
    serializer_class = ConversationSerializer
    permission_classes = [permissions.IsAuthenticated]
    lookup_field = 'id'

    def get_queryset(self):
        return Conversation.objects.all()


class MessageListCreateView(generics.ListCreateAPIView):
    serializer_class = MessageSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        conv_id = self.kwargs.get('conversation_id')
        parent_id = self.request.query_params.get('parent_message_id')
        qs = Message.objects.filter(conversation_id=conv_id)
        if parent_id:
            qs = qs.filter(parent_message_id=parent_id)
        else:
            qs = qs.filter(parent_message__isnull=True)
        return qs.order_by('created_at')

    def create(self, request, *args, **kwargs):
        conv_id = self.kwargs.get('conversation_id')
        try:
            conv = Conversation.objects.get(id=conv_id)
        except Conversation.DoesNotExist:
            return Response({"detail": "Conversation not found."}, status=status.HTTP_404_NOT_FOUND)

        content = request.data.get('content', '')
        parent_id = request.data.get('parent_message_id')
        attachments = request.data.get('attachments', [])

        if not content.strip() and not attachments:
            return Response({"detail": "Message must contain text content or attachments."}, status=status.HTTP_400_BAD_REQUEST)

        parent = Message.objects.get(id=parent_id) if parent_id else None
        sender_name = f"{request.user.first_name} {request.user.last_name}".strip() or request.user.username

        with transaction.atomic():
            msg = Message.objects.create(
                conversation=conv,
                sender=request.user,
                sender_name=sender_name,
                content=content,
                parent_message=parent,
                attachments=attachments
            )
            conv.updated_at = timezone.now()
            conv.save(update_fields=['updated_at'])

            # Unhide conversation for all participants when a new message arrives
            ConversationParticipant.objects.filter(conversation=conv).update(is_hidden=False)

            # Mark conversation read for this sender
            ConversationParticipant.objects.filter(
                conversation=conv,
                user=request.user
            ).update(last_read_at=timezone.now())

            data = MessageSerializer(msg).data

            # Create notifications for conversation participants and mentions
            try:
                from apps.notifications.services import create_notification
                preview = (content[:80] + "...") if len(content) > 80 else content
                if not preview and attachments:
                    preview = "Sent an attachment"

                participants = conv.participants.exclude(user=request.user).select_related('user')
                for p in participants:
                    is_direct = (conv.conversation_type == 'direct')
                    has_mention = (
                        f"@{p.user.username.lower()}" in content.lower() or
                        bool(p.user.first_name and f"@{p.user.first_name.lower()}" in content.lower())
                    )
                    if is_direct or has_mention or conv.conversation_type == 'group':
                        notif_type = "mention" if has_mention else "message"
                        notif_title = f"{sender_name} mentioned you in {conv.title}" if has_mention else f"New message from {sender_name}"
                        create_notification(
                            user=p.user,
                            notification_type=notif_type,
                            title=notif_title,
                            body=preview,
                            organization=conv.organization,
                            data={"conversation_id": str(conv.id), "link": "/chat"}
                        )
            except Exception as e:
                pass

            # Broadcast message via WebSocket
            if channel_layer:
                async_to_sync(channel_layer.group_send)(
                    f"conv_{conv_id}",
                    {
                        "type": "chat.message",
                        "message": data
                    }
                )

            return Response(data, status=status.HTTP_201_CREATED)


class MessageReactionView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, id):
        emoji = request.data.get('emoji')
        if not emoji:
            return Response({"detail": "emoji is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            msg = Message.objects.get(id=id)
        except Message.DoesNotExist:
            return Response({"detail": "Message not found."}, status=status.HTTP_404_NOT_FOUND)

        reactions = dict(msg.reactions or {})
        user_id = request.user.id
        current_users = reactions.get(emoji, [])

        if user_id in current_users:
            current_users.remove(user_id)
            if not current_users:
                reactions.pop(emoji, None)
            else:
                reactions[emoji] = current_users
        else:
            current_users.append(user_id)
            reactions[emoji] = current_users

        msg.reactions = reactions
        msg.save(update_fields=['reactions'])

        # Broadcast reaction change
        if channel_layer:
            async_to_sync(channel_layer.group_send)(
                f"conv_{msg.conversation_id}",
                {
                    "type": "reaction.update",
                    "message_id": str(msg.id),
                    "reactions": reactions
                }
            )

        return Response({"reactions": reactions})


class ConversationMediaView(APIView):
    """
    Returns files and media shared in a specific conversation.
    Verifies that the user is an authorized participant.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, conversation_id):
        try:
            conv = Conversation.objects.get(id=conversation_id)
        except Conversation.DoesNotExist:
            return Response({"detail": "Conversation not found."}, status=status.HTTP_404_NOT_FOUND)

        is_participant = conv.participants.filter(user=request.user).exists()
        if not is_participant and conv.conversation_type != 'channel':
            return Response({"detail": "Access denied."}, status=status.HTTP_403_FORBIDDEN)

        from apps.files.models import FileAttachment
        files = FileAttachment.objects.filter(conversation_id=conversation_id).select_related('uploader').order_by('-created_at')

        results = []
        for f in files:
            results.append({
                "id": str(f.id),
                "filename": f.filename,
                "file_size": f.file_size,
                "mime_type": f.mime_type,
                "download_url": f"/api/v1/files/{f.id}/download/",
                "uploader_name": f"{f.uploader.first_name} {f.uploader.last_name}".strip() or f.uploader.username,
                "created_at": f.created_at.isoformat()
            })

        # Also collect inline attachments from messages if not already in FileAttachment
        messages_with_att = Message.objects.filter(conversation_id=conversation_id).exclude(attachments=[]).order_by('-created_at')
        existing_ids = {r["id"] for r in results}
        for m in messages_with_att:
            for att in (m.attachments or []):
                att_id = str(att.get('id') or '')
                if att_id and att_id not in existing_ids:
                    existing_ids.add(att_id)
                    results.append({
                        "id": att_id,
                        "filename": att.get('filename') or att.get('name') or 'file',
                        "file_size": att.get('file_size') or att.get('size') or 0,
                        "mime_type": att.get('mime_type') or 'application/octet-stream',
                        "download_url": att.get('download_url') or f"/api/v1/files/{att_id}/download/",
                        "uploader_name": m.sender_name,
                        "created_at": m.created_at.isoformat()
                    })

        return Response({
            "count": len(results),
            "results": results
        })


class RemoveConversationView(APIView):
    """
    Remove conversation from user's chat list, or delete for all if authorized.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, id):
        try:
            conv = Conversation.objects.get(id=id)
        except Conversation.DoesNotExist:
            return Response({"detail": "Conversation not found."}, status=status.HTTP_404_NOT_FOUND)

        delete_for_everyone = request.data.get('delete_for_everyone', False)
        if delete_for_everyone:
            from apps.permissions.evaluator import is_org_admin
            is_admin = (conv.created_by == request.user) or (
                conv.organization_id and is_org_admin(request.user, conv.organization_id)
            )
            if not is_admin:
                return Response(
                    {"detail": "You do not have permission to delete this conversation for all participants."},
                    status=status.HTTP_403_FORBIDDEN
                )
            conv.delete()
            return Response({"detail": "Conversation deleted for all participants."})
        else:
            part = ConversationParticipant.objects.filter(conversation=conv, user=request.user).first()
            if part:
                if conv.conversation_type == 'group':
                    part.delete()
                else:
                    part.is_hidden = True
                    part.save(update_fields=['is_hidden'])
            return Response({"detail": "Conversation removed from your chat list."})

    def delete(self, request, id):
        return self.post(request, id)
