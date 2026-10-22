from rest_framework import serializers
from .models import Presence
from apps.accounts.serializers import UserSerializer

class PresenceSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = Presence
        fields = [
            'user', 'status', 'custom_status_message',
            'status_expires_at', 'is_manual', 'last_active_at', 'updated_at'
        ]
        read_only_fields = ['user', 'last_active_at', 'updated_at']
