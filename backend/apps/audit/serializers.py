from rest_framework import serializers
from .models import LetsConnectAuditLog, AdminAuditLog

class AuditLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = LetsConnectAuditLog
        fields = ['id', 'organization', 'user', 'action', 'details', 'ip_address', 'created_at']
