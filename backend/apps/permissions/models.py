import uuid
from django.db import models
from django.contrib.auth.models import User
from apps.organizations.models import Organization

class OrganizationPolicy(models.Model):
    """
    Unmanaged mirror of tc_organization_policies.
    Controls delegated permissions:
    - team_owner_can_add_users
    - team_owner_can_create_teams_channels
    - user_can_create_teams_channels
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.OneToOneField(Organization, on_delete=models.CASCADE, related_name="organization_policy")
    team_owner_can_add_users = models.BooleanField(default=False)
    team_owner_can_create_teams_channels = models.BooleanField(default=False)
    user_can_create_teams_channels = models.BooleanField(default=False)
    updated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = False
        db_table = "tc_organization_policies"

    def __str__(self):
        return f"Policies for {self.organization.display_name}"


class MeetingPolicy(models.Model):
    """
    Unmanaged mirror of tc_meeting_policies.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="meeting_policies")
    name = models.CharField(max_length=150)
    description = models.TextField(blank=True, default="")
    is_default = models.BooleanField(default=False)
    allow_cloud_recording = models.BooleanField(default=True)
    allow_screen_sharing = models.BooleanField(default=True)
    allow_participant_unmute = models.BooleanField(default=True)
    allow_external_participants = models.BooleanField(default=False)
    require_meeting_passcode = models.BooleanField(default=True)
    allow_meeting_chat = models.BooleanField(default=True)
    allow_virtual_backgrounds = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        managed = False
        db_table = "tc_meeting_policies"

    def __str__(self):
        return self.name


class MessagingPolicy(models.Model):
    """
    Unmanaged mirror of tc_messaging_policies.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="messaging_policies")
    name = models.CharField(max_length=150)
    description = models.TextField(blank=True, default="")
    is_default = models.BooleanField(default=False)
    allow_chat = models.BooleanField(default=True)
    allow_edit_messages = models.BooleanField(default=True)
    allow_delete_messages = models.BooleanField(default=True)
    allow_external_communication = models.BooleanField(default=False)
    allow_file_sharing = models.BooleanField(default=True)
    allow_guest_chat = models.BooleanField(default=False)
    max_file_size_mb = models.PositiveIntegerField(default=50)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        managed = False
        db_table = "tc_messaging_policies"

    def __str__(self):
        return self.name
