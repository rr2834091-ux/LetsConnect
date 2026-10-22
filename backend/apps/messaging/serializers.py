from rest_framework import serializers
from .models import Conversation, ConversationParticipant, Message
from apps.accounts.serializers import UserSerializer

class MessageSerializer(serializers.ModelSerializer):
    sender = UserSerializer(read_only=True)
    replies_count = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = [
            'id', 'conversation', 'sender', 'sender_name', 'content',
            'parent_message', 'is_edited', 'is_deleted', 'attachments',
            'reactions', 'replies_count', 'created_at'
        ]
        read_only_fields = ['id', 'sender', 'sender_name', 'created_at']

    def get_replies_count(self, obj):
        return obj.replies.count()


class ConversationParticipantSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = ConversationParticipant
        fields = ['id', 'user', 'role', 'joined_at', 'last_read_at']


class ConversationSerializer(serializers.ModelSerializer):
    participants = ConversationParticipantSerializer(many=True, read_only=True)
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = [
            'id', 'conversation_type', 'organization', 'channel',
            'meeting_id', 'title', 'created_by', 'participants',
            'last_message', 'unread_count', 'updated_at', 'created_at'
        ]
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']

    def get_last_message(self, obj):
        msg = obj.messages.order_by('-created_at').first()
        if msg:
            return {
                "id": str(msg.id),
                "sender_name": msg.sender_name,
                "content": msg.content[:60],
                "created_at": msg.created_at.isoformat()
            }
        return None

    def get_unread_count(self, obj):
        user = self.context.get('request').user if 'request' in self.context else None
        if not user or not user.is_authenticated:
            return 0
        part = obj.participants.filter(user=user).first()
        if part and part.last_read_at:
            return obj.messages.filter(created_at__gt=part.last_read_at).exclude(sender=user).count()
        elif part:
            return obj.messages.exclude(sender=user).count()
        return 0
