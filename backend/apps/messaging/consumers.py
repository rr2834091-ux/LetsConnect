import json
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from channels.db import database_sync_to_async
from django.utils import timezone
from django.contrib.auth.models import AnonymousUser

class LetsConnectConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        query_string = self.scope.get('query_string', b'').decode('utf-8')
        params = dict(qc.split('=') for qc in query_string.split('&') if '=' in qc)
        token_key = params.get('token')

        self.user = await self.get_user_from_token(token_key)
        if not self.user or self.user.is_anonymous:
            await self.close(code=4001)
            return

        self.user_group = f"user_{self.user.id}"
        await self.channel_layer.group_add(self.user_group, self.channel_name)
        await self.accept()

        # Update presence to available
        await self.set_user_presence("available")

        await self.send_json({
            "type": "connection_established",
            "user_id": self.user.id,
            "message": "Connected to LetsConnect Real-Time Gateway"
        })

    async def disconnect(self, close_code):
        if hasattr(self, 'user') and self.user and not self.user.is_anonymous:
            await self.channel_layer.group_discard(self.user_group, self.channel_name)
            # Set presence to offline
            await self.set_user_presence("offline")

    async def receive_json(self, content):
        action = content.get('action')

        if action == 'join_conversation':
            conv_id = content.get('conversation_id')
            if conv_id:
                group_name = f"conv_{conv_id}"
                await self.channel_layer.group_add(group_name, self.channel_name)
                await self.send_json({"type": "joined_conversation", "conversation_id": conv_id})

        elif action == 'leave_conversation':
            conv_id = content.get('conversation_id')
            if conv_id:
                group_name = f"conv_{conv_id}"
                await self.channel_layer.group_discard(group_name, self.channel_name)

        elif action == 'typing':
            conv_id = content.get('conversation_id')
            is_typing = content.get('is_typing', True)
            if conv_id:
                group_name = f"conv_{conv_id}"
                await self.channel_layer.group_send(
                    group_name,
                    {
                        "type": "chat.typing",
                        "conversation_id": conv_id,
                        "user_id": self.user.id,
                        "user_name": f"{self.user.first_name} {self.user.last_name}".strip() or self.user.username,
                        "is_typing": is_typing
                    }
                )

        elif action == 'send_message':
            conv_id = content.get('conversation_id')
            text = content.get('content', '')
            parent_id = content.get('parent_message_id')
            attachments = content.get('attachments', [])

            if conv_id and (text.strip() or attachments):
                msg_data = await self.save_message(conv_id, text, parent_id, attachments)
                group_name = f"conv_{conv_id}"
                await self.channel_layer.group_send(
                    group_name,
                    {
                        "type": "chat.message",
                        "message": msg_data
                    }
                )

        elif action == 'presence_status':
            status = content.get('status', 'available')
            custom_msg = content.get('custom_message', '')
            await self.set_user_presence(status, custom_msg)
            # Broadcast to user's org presence group
            org_id = content.get('organization_id')
            if org_id:
                await self.channel_layer.group_send(
                    f"presence_{org_id}",
                    {
                        "type": "presence.update",
                        "user_id": self.user.id,
                        "status": status,
                        "custom_message": custom_msg
                    }
                )

        elif action == 'join_presence':
            org_id = content.get('organization_id')
            if org_id:
                await self.channel_layer.group_add(f"presence_{org_id}", self.channel_name)

    async def chat_message(self, event):
        await self.send_json({
            "type": "new_message",
            "message": event["message"]
        })

    async def chat_typing(self, event):
        await self.send_json({
            "type": "typing_indicator",
            "conversation_id": event["conversation_id"],
            "user_id": event["user_id"],
            "user_name": event["user_name"],
            "is_typing": event["is_typing"]
        })

    async def presence_update(self, event):
        await self.send_json({
            "type": "presence_update",
            "user_id": event["user_id"],
            "status": event["status"],
            "custom_message": event["custom_message"]
        })

    async def reaction_update(self, event):
        await self.send_json({
            "type": "reaction_update",
            "message_id": event["message_id"],
            "reactions": event["reactions"]
        })

    async def new_notification(self, event):
        await self.send_json({
            "type": "new_notification",
            "notification": event.get("notification")
        })

    async def notification_message(self, event):
        await self.send_json({
            "type": "new_notification",
            "notification": event.get("notification")
        })

    @database_sync_to_async
    def get_user_from_token(self, token_key):
        if not token_key:
            return AnonymousUser()
        from rest_framework.authtoken.models import Token
        try:
            token = Token.objects.select_related('user').get(key=token_key)
            return token.user
        except Token.DoesNotExist:
            return AnonymousUser()

    @database_sync_to_async
    def set_user_presence(self, status, custom_message=""):
        from apps.presence.models import Presence
        Presence.objects.update_or_create(
            user=self.user,
            defaults={
                'status': status,
                'custom_status_message': custom_message,
                'last_active_at': timezone.now()
            }
        )

    @database_sync_to_async
    def save_message(self, conversation_id, content, parent_id=None, attachments=None):
        from .models import Conversation, Message, ConversationParticipant
        conv = Conversation.objects.get(id=conversation_id)
        parent = Message.objects.get(id=parent_id) if parent_id else None
        sender_name = f"{self.user.first_name} {self.user.last_name}".strip() or self.user.username

        msg = Message.objects.create(
            conversation=conv,
            sender=self.user,
            sender_name=sender_name,
            content=content,
            parent_message=parent,
            attachments=attachments or []
        )
        conv.updated_at = timezone.now()
        conv.save(update_fields=['updated_at'])

        # Update last_read_at for sender
        ConversationParticipant.objects.filter(
            conversation=conv,
            user=self.user
        ).update(last_read_at=timezone.now())

        # Notify participants
        try:
            from apps.notifications.services import create_notification
            preview = (content[:80] + "...") if len(content) > 80 else content
            if not preview and attachments:
                preview = "Sent an attachment"

            participants = conv.participants.exclude(user=self.user).select_related('user')
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

        return {
            "id": str(msg.id),
            "conversation_id": str(conv.id),
            "sender_id": self.user.id,
            "sender_name": sender_name,
            "content": msg.content,
            "parent_message_id": str(parent.id) if parent else None,
            "attachments": msg.attachments,
            "reactions": msg.reactions,
            "created_at": msg.created_at.isoformat()
        }
