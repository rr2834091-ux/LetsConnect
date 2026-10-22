import os
import uuid
from abc import ABC, abstractmethod
from django.conf import settings
from django.core.files.storage import default_storage

class StorageDriver(ABC):
    @abstractmethod
    def upload(self, file_obj, destination_path: str) -> str:
        pass

    @abstractmethod
    def get_url(self, storage_path: str) -> str:
        pass


class SupabaseStorageDriver(StorageDriver):
    def __init__(self):
        self.supabase_url = getattr(settings, 'SUPABASE_URL', '')
        self.supabase_key = getattr(settings, 'SUPABASE_KEY', '')
        self.bucket = getattr(settings, 'SUPABASE_STORAGE_BUCKET', 'letsconnect-attachments')

    def upload(self, file_obj, destination_path: str) -> str:
        # If Supabase credentials are configured, push to Supabase Storage
        if self.supabase_url and self.supabase_key:
            try:
                import requests
                headers = {
                    "apikey": self.supabase_key,
                    "Authorization": f"Bearer {self.supabase_key}",
                }
                url = f"{self.supabase_url}/storage/v1/object/{self.bucket}/{destination_path}"
                file_obj.seek(0)
                resp = requests.post(url, headers=headers, data=file_obj.read())
                if resp.status_code in [200, 201]:
                    return f"{self.supabase_url}/storage/v1/object/public/{self.bucket}/{destination_path}"
            except Exception:
                pass

        # Fallback to Django default storage (local media)
        file_obj.seek(0)
        saved_name = default_storage.save(f"uploads/{destination_path}", file_obj)
        return default_storage.url(saved_name)

    def get_url(self, storage_path: str) -> str:
        if storage_path.startswith("http"):
            return storage_path
        return f"{settings.MEDIA_URL}{storage_path}"


def get_storage_driver() -> StorageDriver:
    return SupabaseStorageDriver()
