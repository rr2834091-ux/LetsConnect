import uuid
from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone

class Presence(models.Model):
    """
    User presence and availability tracking with manual overrides and status messages.
    """
    STATUS_CHOICES = [
        ("available", "Available"),
        ("busy", "Busy"),
        ("dnd", "Do Not Disturb"),
        ("away", "Away"),
        ("be_right_back", "Be Right Back"),
        ("offline", "Appear Offline"),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, primary_key=True, related_name="presence")
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default="available")
    custom_status_message = models.CharField(max_length=255, blank=True, default="")
    status_expires_at = models.DateTimeField(null=True, blank=True)
    is_manual = models.BooleanField(default=False)
    last_active_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        managed = True
        db_table = "lc_presence"

    def __str__(self):
        return f"{self.user.username}: {self.status}"
