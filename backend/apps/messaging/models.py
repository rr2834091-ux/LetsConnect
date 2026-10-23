import uuid
from django.db import models
from django.contrib.auth.models import User
from apps.organizations.models import Organization
from apps.channels.models import Channel

class Conversation(models.Model):
    """
    Collaboration conversation stream in LetsConnect.
    Supports 1:1 direct messages, group chats, channel streams, and meeting chats.
    """
    TYPE_CHOICES = [
        ("direct", "Direct Message"),
        ("group", "Group Chat"),
        ("channel", "Channel Chat"),
        ("meeting", "Meeting Chat"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    conversation_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default="direct")
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, null=True, blank=True, related_name="conversations")
    channel = models.ForeignKey(Channel, on_delete=models.CASCADE, null=True, blank=True, related_name="conversations")
    community = models.ForeignKey("lc_communities.PersonalCommunity", on_delete=models.CASCADE, null=True, blank=True, related_name="conversations")
    community_channel = models.ForeignKey("lc_communities.PersonalCommunityChannel", on_delete=models.CASCADE, null=True, blank=True, related_name="conversations")
    meeting_id = models.UUIDField(null=True, blank=True)
    title = models.CharField(max_length=255, blank=True, default="")
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name="created_conversations")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        managed = True
        db_table = "lc_conversations"
        ordering = ["-updated_at"]

    def __str__(self):
        return f"{self.conversation_type.capitalize()} Conversation: {self.title or self.id}"


class ConversationParticipant(models.Model):
    """
    Participants in a direct or group conversation.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name="participants")
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="conversations_joined")
    employee_id = models.UUIDField(null=True, blank=True)
    role = models.CharField(max_length=20, default="member")
    joined_at = models.DateTimeField(auto_now_add=True)
    last_read_at = models.DateTimeField(null=True, blank=True)
    is_hidden = models.BooleanField(default=False)

    class Meta:
        managed = True
        db_table = "lc_conversation_participants"
        constraints = [
            models.UniqueConstraint(fields=["conversation", "user"], name="unique_conversation_user")
        ]

    def __str__(self):
        return f"{self.user.username} in {self.conversation.id}"


class Message(models.Model):
    """
    Persistent message with replies/threading, attachments, and reactions.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name="messages")
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name="sent_messages")
    sender_name = models.CharField(max_length=150)
    content = models.TextField(blank=True, default="")
    parent_message = models.ForeignKey("self", on_delete=models.SET_NULL, null=True, blank=True, related_name="replies")
    is_edited = models.BooleanField(default=False)
    is_deleted = models.BooleanField(default=False)
    attachments = models.JSONField(default=list, blank=True)
    reactions = models.JSONField(default=dict, blank=True)  # e.g. {"👍": [user_id_1, user_id_2]}
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        managed = True
        db_table = "lc_messages"
        ordering = ["created_at"]
        indexes = [
            models.Index(fields=["conversation", "created_at"]),
        ]

    def __str__(self):
        return f"{self.sender_name}: {self.content[:30]}"
