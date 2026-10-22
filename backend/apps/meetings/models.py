import uuid
from django.db import models
from django.contrib.auth.models import User
from apps.organizations.models import Organization

class Meeting(models.Model):
    """
    Audio/video conference meeting, backing a LiveKit Cloud room.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, null=True, blank=True, related_name="meetings")
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    room_name = models.CharField(max_length=100, unique=True)
    host = models.ForeignKey(User, on_delete=models.CASCADE, related_name="hosted_meetings")
    scheduled_start = models.DateTimeField(null=True, blank=True)
    scheduled_end = models.DateTimeField(null=True, blank=True)
    passcode = models.CharField(max_length=50, blank=True, default="")
    is_instant = models.BooleanField(default=False)
    is_ended = models.BooleanField(default=False)
    allow_guest = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        managed = True
        db_table = "lc_meetings"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.title} ({self.room_name})"


class MeetingParticipant(models.Model):
    """
    Tracks participant attendance in a meeting.
    """
    ROLE_CHOICES = [
        ("host", "Host"),
        ("speaker", "Speaker"),
        ("attendee", "Attendee"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    meeting = models.ForeignKey(Meeting, on_delete=models.CASCADE, related_name="participants")
    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True, related_name="meeting_participations")
    guest_name = models.CharField(max_length=150, blank=True, default="")
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default="attendee")
    joined_at = models.DateTimeField(auto_now_add=True)
    left_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        managed = True
        db_table = "lc_meeting_participants"

    def __str__(self):
        name = self.user.username if self.user else f"Guest ({self.guest_name})"
        return f"{name} in {self.meeting.title}"
