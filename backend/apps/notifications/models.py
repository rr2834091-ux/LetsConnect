import uuid
from django.db import models
from django.contrib.auth.models import User
from apps.organizations.models import Organization

class Notification(models.Model):
    """
    In-app and push notification alerts for collaboration events.
    """
    TYPE_CHOICES = [
        ("message", "New Message"),
        ("mention", "Mention"),
        ("team_invite", "Team Invitation"),
        ("meeting_invite", "Meeting Invitation"),
        ("system", "System Alert"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="notifications")
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, null=True, blank=True, related_name="notifications")
    notification_type = models.CharField(max_length=50, choices=TYPE_CHOICES, default="message")
    title = models.CharField(max_length=255)
    body = models.TextField()
    data = models.JSONField(default=dict, blank=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = True
        db_table = "lc_notifications"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user.username} - {self.title}"
