import uuid
from django.db import models
from django.contrib.auth.models import User
from apps.organizations.models import Organization

class FileAttachment(models.Model):
    """
    Storage metadata tracking for uploaded documents, media, and attachments.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, null=True, blank=True, related_name="files")
    uploader = models.ForeignKey(User, on_delete=models.CASCADE, related_name="uploaded_files")
    filename = models.CharField(max_length=255)
    file_size = models.BigIntegerField()
    mime_type = models.CharField(max_length=100)
    storage_path = models.CharField(max_length=500)
    storage_provider = models.CharField(max_length=50, default="supabase")
    conversation_id = models.UUIDField(null=True, blank=True)
    channel_id = models.UUIDField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = True
        db_table = "lc_files"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.filename} ({self.file_size} bytes)"
