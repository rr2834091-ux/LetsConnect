from rest_framework import serializers
from .models import FileAttachment
from .storage import get_storage_driver
from apps.accounts.serializers import UserSerializer

class FileAttachmentSerializer(serializers.ModelSerializer):
    uploader = UserSerializer(read_only=True)
    download_url = serializers.SerializerMethodField()

    class Meta:
        model = FileAttachment
        fields = [
            'id', 'organization', 'uploader', 'filename', 'file_size',
            'mime_type', 'storage_path', 'download_url', 'conversation_id',
            'channel_id', 'created_at'
        ]
        read_only_fields = ['id', 'uploader', 'file_size', 'mime_type', 'storage_path', 'created_at']

    def get_download_url(self, obj):
        request = self.context.get('request')
        if request:
            return request.build_absolute_uri(f"/api/v1/files/{obj.id}/download/")
        return f"/api/v1/files/{obj.id}/download/"
