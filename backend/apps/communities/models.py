import uuid
import secrets
from django.db import models
from django.contrib.auth.models import User
from django.utils.text import slugify

class PersonalProfile(models.Model):
    """
    Dedicated profile for a user's personal context, isolated from enterprise employee records.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="personal_profile")
    display_name = models.CharField(max_length=150, blank=True, default="")
    bio = models.TextField(blank=True, default="")
    avatar_url = models.CharField(max_length=500, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        managed = True
        db_table = "lc_personal_profiles"

    def __str__(self):
        return f"Personal Profile: {self.display_name or self.user.username}"


class PersonalCommunity(models.Model):
    """
    Independent personal community created by personal users.
    Completely isolated from tc_organizations.
    """
    JOIN_POLICY_CHOICES = [
        ("open", "Open Join"),
        ("invite_only", "Invite Only"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=150)
    slug = models.SlugField(max_length=160, blank=True)
    description = models.TextField(blank=True, default="")
    avatar_url = models.CharField(max_length=500, blank=True, default="")
    banner_url = models.CharField(max_length=500, blank=True, default="")
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name="owned_communities")
    is_private = models.BooleanField(default=False)
    join_policy = models.CharField(max_length=20, choices=JOIN_POLICY_CHOICES, default="open")
    invite_code = models.CharField(max_length=32, unique=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        managed = True
        db_table = "lc_personal_communities"
        ordering = ["name"]

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name) or "community"
        if not self.invite_code:
            self.invite_code = secrets.token_hex(8)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} (Community)"


class PersonalCommunityMembership(models.Model):
    """
    User membership and roles within a personal community.
    """
    ROLE_CHOICES = [
        ("owner", "Community Owner"),
        ("moderator", "Moderator"),
        ("member", "Member"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    community = models.ForeignKey(PersonalCommunity, on_delete=models.CASCADE, related_name="memberships")
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="community_memberships")
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default="member")
    nickname = models.CharField(max_length=100, blank=True, default="")
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = True
        db_table = "lc_personal_community_memberships"
        ordering = ["joined_at"]
        constraints = [
            models.UniqueConstraint(fields=["community", "user"], name="unique_personal_community_member")
        ]

    def __str__(self):
        return f"{self.user.username} in {self.community.name} ({self.role})"


class PersonalCommunityChannel(models.Model):
    """
    Channel within a personal community for conversations and announcements.
    """
    CHANNEL_TYPE_CHOICES = [
        ("text", "Text Channel"),
        ("voice", "Voice Channel"),
        ("announcement", "Announcement"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    community = models.ForeignKey(PersonalCommunity, on_delete=models.CASCADE, related_name="channels")
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, default="")
    channel_type = models.CharField(max_length=20, choices=CHANNEL_TYPE_CHOICES, default="text")
    is_private = models.BooleanField(default=False)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name="created_community_channels")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        managed = True
        db_table = "lc_personal_community_channels"
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(fields=["community", "name"], name="unique_channel_per_community")
        ]

    def __str__(self):
        return f"#{self.name} in {self.community.name}"


class PersonalChannelMembership(models.Model):
    """
    Explicit authorization for private community channels.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    channel = models.ForeignKey(PersonalCommunityChannel, on_delete=models.CASCADE, related_name="private_memberships")
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="private_channel_memberships")
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = True
        db_table = "lc_personal_channel_memberships"
        constraints = [
            models.UniqueConstraint(fields=["channel", "user"], name="unique_private_comm_channel_member")
        ]

    def __str__(self):
        return f"{self.user.username} in private #{self.channel.name}"
