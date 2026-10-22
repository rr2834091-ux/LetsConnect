from rest_framework import serializers
from .models import Meeting, MeetingParticipant
from apps.accounts.serializers import UserSerializer

class MeetingParticipantSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = MeetingParticipant
        fields = ['id', 'user', 'guest_name', 'role', 'joined_at', 'left_at']


class MeetingSerializer(serializers.ModelSerializer):
    host = UserSerializer(read_only=True)
    participants = MeetingParticipantSerializer(many=True, read_only=True)

    class Meta:
        model = Meeting
        fields = [
            'id', 'organization', 'title', 'description', 'room_name',
            'host', 'scheduled_start', 'scheduled_end', 'passcode',
            'is_instant', 'is_ended', 'allow_guest', 'participants',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'room_name', 'host', 'created_at', 'updated_at']


class JoinMeetingSerializer(serializers.Serializer):
    meeting_id = serializers.CharField(required=True)
    passcode = serializers.CharField(required=False, allow_blank=True, default="")
    guest_name = serializers.CharField(required=False, allow_blank=True, default="")
