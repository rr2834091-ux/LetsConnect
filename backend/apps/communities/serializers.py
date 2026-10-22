from rest_framework import serializers
from .models import (
    PersonalProfile,
    PersonalCommunity,
    PersonalCommunityMembership,
    PersonalCommunityChannel,
    PersonalChannelMembership
)
from apps.accounts.serializers import UserSerializer

class PersonalProfileSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = PersonalProfile
        fields = ['id', 'user', 'display_name', 'bio', 'avatar_url', 'created_at', 'updated_at']
        read_only_fields = ['id', 'user', 'created_at', 'updated_at']


class PersonalCommunityChannelSerializer(serializers.ModelSerializer):
    created_by = UserSerializer(read_only=True)
    conversation_id = serializers.SerializerMethodField()

    class Meta:
        model = PersonalCommunityChannel
        fields = ['id', 'community', 'name', 'description', 'channel_type', 'is_private', 'created_by', 'conversation_id', 'created_at']
        read_only_fields = ['id', 'community', 'created_by', 'created_at']

    def get_conversation_id(self, obj):
        from apps.messaging.models import Conversation
        conv = Conversation.objects.filter(community_channel=obj).first()
        if not conv:
            conv = Conversation.objects.filter(title=f"#{obj.name}", organization__isnull=True).first()
        return str(conv.id) if conv else None


class PersonalCommunityMembershipSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = PersonalCommunityMembership
        fields = ['id', 'community', 'user', 'role', 'nickname', 'joined_at']
        read_only_fields = ['id', 'community', 'user', 'joined_at']


class PersonalCommunitySerializer(serializers.ModelSerializer):
    owner = UserSerializer(read_only=True)
    members_count = serializers.SerializerMethodField()
    channels = PersonalCommunityChannelSerializer(many=True, read_only=True)
    user_role = serializers.SerializerMethodField()

    class Meta:
        model = PersonalCommunity
        fields = [
            'id', 'name', 'slug', 'description', 'avatar_url', 'banner_url',
            'owner', 'is_private', 'join_policy', 'invite_code', 'members_count',
            'channels', 'user_role', 'created_at'
        ]
        read_only_fields = ['id', 'slug', 'owner', 'invite_code', 'created_at']

    def get_members_count(self, obj):
        return obj.memberships.count()

    def get_user_role(self, obj):
        request = self.context.get('request')
        if not request or not request.user or not request.user.is_authenticated:
            return None
        membership = obj.memberships.filter(user=request.user).first()
        return membership.role if membership else None
