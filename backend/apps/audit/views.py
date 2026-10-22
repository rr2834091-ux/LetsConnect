from rest_framework import generics, permissions, exceptions
from .models import LetsConnectAuditLog
from .serializers import AuditLogSerializer
from apps.permissions.evaluator import is_org_admin

class AuditLogListView(generics.ListAPIView):
    serializer_class = AuditLogSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        org_id = self.request.query_params.get('organization_id') or getattr(self.request, 'active_org_id', None)
        if not org_id:
            raise exceptions.ValidationError({"detail": "organization_id is required."})

        # Only organization administrators can view audit logs
        if not is_org_admin(self.request.user, org_id):
            raise exceptions.PermissionDenied("Only organization administrators can view audit records.")

        return LetsConnectAuditLog.objects.filter(organization_id=org_id).order_by('-created_at')
