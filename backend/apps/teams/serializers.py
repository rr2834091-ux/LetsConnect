from rest_framework import serializers
from .models import Team, TeamMembership
from apps.memberships.serializers import EmployeeSerializer

class TeamMembershipSerializer(serializers.ModelSerializer):
    employee = EmployeeSerializer(read_only=True)

    class Meta:
        model = TeamMembership
        fields = ['id', 'team', 'employee', 'role_in_team', 'joined_at']


class TeamSerializer(serializers.ModelSerializer):
    member_count = serializers.SerializerMethodField()
    channels_count = serializers.SerializerMethodField()
    user_role = serializers.SerializerMethodField()

    class Meta:
        model = Team
        fields = [
            'id', 'organization', 'name', 'description', 'visibility',
            'is_archived', 'allow_member_create_channels', 'allow_mentions',
            'member_count', 'channels_count', 'user_role', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']

    def get_member_count(self, obj):
        return TeamMembership.objects.filter(team=obj).count()

    def get_channels_count(self, obj):
        from apps.channels.models import Channel
        return Channel.objects.filter(team=obj, is_archived=False).count()

    def get_user_role(self, obj):
        user = self.context.get('request').user if 'request' in self.context else None
        if not user or not user.is_authenticated:
            return None
        from apps.memberships.models import Employee, AdminProfile
        if AdminProfile.objects.filter(user=user, organization=obj.organization).exists():
            return "owner"
        membership = TeamMembership.objects.filter(
            team=obj,
            employee__email__iexact=user.email
        ).first()
        return membership.role_in_team if membership else None


class TeamCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Team
        fields = ['id', 'organization', 'name', 'description', 'visibility']
