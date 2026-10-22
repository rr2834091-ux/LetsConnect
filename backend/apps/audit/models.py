import uuid
from django.db import models
from django.contrib.auth.models import User
from apps.organizations.models import Organization

class AdminAuditLog(models.Model):
    """
    Unmanaged mirror of tc_admin_audit_logs.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, null=True, blank=True, related_name="admin_audit_logs")
    admin_username = models.CharField(max_length=150)
    action = models.CharField(max_length=100)
    resource_type = models.CharField(max_length=100)
    resource_id = models.CharField(max_length=100, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    details = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = False
        db_table = "tc_admin_audit_logs"
        ordering = ["-created_at"]


class LetsConnectAuditLog(models.Model):
    """
    Audit log for user and collaboration actions within LetsConnect.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, null=True, blank=True, related_name="lc_audit_logs")
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="audit_logs")
    action = models.CharField(max_length=100)  # e.g. TEAM_CREATED, CHANNEL_CREATED, MEETING_JOINED
    details = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = True
        db_table = "lc_audit_logs"
        ordering = ["-created_at"]

    def __str__(self):
        return f"[{self.created_at}] {self.action} by {self.user}"
