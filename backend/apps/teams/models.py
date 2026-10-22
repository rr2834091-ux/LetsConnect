import uuid
from django.db import models
from apps.organizations.models import Organization
from apps.memberships.models import Employee

class Team(models.Model):
    """
    Unmanaged mirror of tc_teams.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="teams")
    name = models.CharField(max_length=150)
    description = models.TextField(blank=True)
    visibility = models.CharField(max_length=20, default="public")  # 'public' or 'private'
    is_archived = models.BooleanField(default=False)
    allow_member_create_channels = models.BooleanField(default=True)
    allow_member_add_apps = models.BooleanField(default=True)
    allow_mentions = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        managed = False
        db_table = "tc_teams"
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.organization.display_name})"


class TeamMembership(models.Model):
    """
    Unmanaged mirror of tc_team_memberships.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    team = models.ForeignKey(Team, on_delete=models.CASCADE, related_name="memberships")
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="team_memberships")
    role_in_team = models.CharField(max_length=20, default="member")  # 'owner' or 'member'
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = False
        db_table = "tc_team_memberships"
        ordering = ["-joined_at"]

    def __str__(self):
        return f"{self.employee.email} in {self.team.name} ({self.role_in_team})"
