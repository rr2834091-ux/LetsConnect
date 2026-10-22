import uuid
from django.db import models
from apps.teams.models import Team
from apps.memberships.models import Employee

class Channel(models.Model):
    """
    Unmanaged mirror of tc_channels.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    team = models.ForeignKey(Team, on_delete=models.CASCADE, related_name="channels")
    name = models.CharField(max_length=150)
    description = models.TextField(blank=True)
    channel_type = models.CharField(max_length=20, default="standard")  # 'standard' or 'private'
    is_archived = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        managed = False
        db_table = "tc_channels"
        ordering = ["name"]

    def __str__(self):
        return f"#{self.name} in {self.team.name}"


class ChannelMembership(models.Model):
    """
    Unmanaged mirror of tc_channel_memberships.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    channel = models.ForeignKey(Channel, on_delete=models.CASCADE, related_name="memberships")
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="channel_memberships")
    role_in_channel = models.CharField(max_length=20, default="member")
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = False
        db_table = "tc_channel_memberships"

    def __str__(self):
        return f"{self.employee.email} in #{self.channel.name}"
