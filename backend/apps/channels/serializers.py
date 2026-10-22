from rest_framework import serializers
from .models import Channel, ChannelMembership
from apps.memberships.serializers import EmployeeSerializer

class ChannelSerializer(serializers.ModelSerializer):
    conversation_id = serializers.SerializerMethodField()

    class Meta:
        model = Channel
        fields = [
            'id', 'team', 'name', 'description', 'channel_type',
            'is_archived', 'conversation_id', 'created_at'
        ]
        read_only_fields = ['id', 'created_at', 'conversation_id']

    def get_conversation_id(self, obj):
        from apps.messaging.models import Conversation
        conv = Conversation.objects.filter(channel=obj).first()
        return str(conv.id) if conv else None


class ChannelMembershipSerializer(serializers.ModelSerializer):
    employee = EmployeeSerializer(read_only=True)

    class Meta:
        model = ChannelMembership
        fields = ['id', 'channel', 'employee', 'role_in_channel', 'joined_at']
