from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.utils import timezone
from datetime import timedelta
from .models import Presence
from .serializers import PresenceSerializer
from apps.memberships.models import Employee

class OrganizationPresenceListView(generics.ListAPIView):
    """
    List presence status of all active colleagues within user's active organization.
    """
    serializer_class = PresenceSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        org_id = self.request.query_params.get('organization_id') or getattr(self.request, 'active_org_id', None)
        if not org_id:
            return Presence.objects.filter(user=user)

        # Get emails of colleagues in this organization
        colleague_emails = Employee.objects.filter(
            organization_id=org_id,
            status='active'
        ).values_list('email', flat=True)

        return Presence.objects.filter(user__email__in=colleague_emails)


class UpdatePresenceStatusView(APIView):
    """
    Update manual presence status and custom status message.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        status_val = request.data.get('status', 'available')
        custom_message = request.data.get('custom_message', '')
        expires_minutes = request.data.get('expires_in_minutes')

        expires_at = None
        if expires_minutes:
            expires_at = timezone.now() + timedelta(minutes=int(expires_minutes))

        presence, _ = Presence.objects.update_or_create(
            user=request.user,
            defaults={
                'status': status_val,
                'custom_status_message': custom_message,
                'status_expires_at': expires_at,
                'is_manual': True,
                'last_active_at': timezone.now()
            }
        )

        serializer = PresenceSerializer(presence)
        return Response(serializer.data)


class HeartbeatView(APIView):
    """
    Activity heartbeat sent periodically by web or Android client.
    Maintains active status unless overridden by manual DND / Busy.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        presence, _ = Presence.objects.get_or_create(user=request.user)
        presence.last_active_at = timezone.now()

        # If presence expired, reset to available
        if presence.status_expires_at and timezone.now() > presence.status_expires_at:
            presence.status = 'available'
            presence.status_expires_at = None
            presence.is_manual = False

        # If user was marked away automatically, restore to available
        if not presence.is_manual and presence.status == 'away':
            presence.status = 'available'

        presence.save(update_fields=['last_active_at', 'status', 'status_expires_at', 'is_manual'])
        return Response({"status": presence.status})
