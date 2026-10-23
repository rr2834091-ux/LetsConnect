import os
import uuid
import logging
from abc import ABC, abstractmethod
from django.conf import settings
from django.core.files.storage import default_storage

logger = logging.getLogger(__name__)

class StorageDriver(ABC):
    @abstractmethod
    def upload(self, file_obj, destination_path: str, content_type: str = None) -> str:
        pass

    @abstractmethod
    def get_signed_url(self, storage_path: str, expires_in: int = 3600) -> str:
        pass

    @abstractmethod
    def delete(self, storage_path: str) -> bool:
        pass


class SupabaseStorageDriver(StorageDriver):
    """
    Production storage driver integrating directly with Supabase Storage REST API
    with support for private buckets and organisation-scoped signed URLs.
    """
    def __init__(self):
        self.supabase_url = getattr(settings, 'SUPABASE_URL', '').rstrip('/')
        self.supabase_key = getattr(settings, 'SUPABASE_KEY', '')
        self.bucket = getattr(settings, 'SUPABASE_STORAGE_BUCKET', 'file_storage')
        self.ssl_verify = getattr(settings, 'SUPABASE_SSL_VERIFY', False)

    def upload(self, file_obj, destination_path: str, content_type: str = None) -> str:
        # Standardize destination path: strip leading slashes
        clean_path = destination_path.lstrip('/')

        if self.supabase_url and self.supabase_key:
            try:
                import requests
                headers = {
                    "apikey": self.supabase_key,
                    "Authorization": f"Bearer {self.supabase_key}",
                    "Content-Type": content_type or getattr(file_obj, 'content_type', 'application/octet-stream') or 'application/octet-stream',
                    "x-upsert": "true",
                }
                url = f"{self.supabase_url}/storage/v1/object/{self.bucket}/{clean_path}"
                file_obj.seek(0)
                data = file_obj.read()
                
                resp = requests.post(url, headers=headers, data=data, verify=self.ssl_verify)
                if resp.status_code in [200, 201]:
                    # Return standard storage object path
                    return clean_path
                else:
                    logger.warning(f"Supabase upload returned {resp.status_code}: {resp.text}")
            except Exception as e:
                logger.error(f"Error during Supabase upload: {e}")

        # Fallback to Django default storage (local media)
        file_obj.seek(0)
        saved_name = default_storage.save(f"uploads/{clean_path}", file_obj)
        return saved_name

    def get_signed_url(self, storage_path: str, expires_in: int = 3600) -> str:
        clean_path = storage_path.lstrip('/')
        if self.supabase_url and self.supabase_key:
            try:
                import requests
                headers = {
                    "apikey": self.supabase_key,
                    "Authorization": f"Bearer {self.supabase_key}",
                    "Content-Type": "application/json",
                }
                url = f"{self.supabase_url}/storage/v1/object/sign/{self.bucket}/{clean_path}"
                resp = requests.post(
                    url,
                    headers=headers,
                    json={"expiresIn": expires_in},
                    verify=self.ssl_verify
                )
                if resp.status_code == 200:
                    payload = resp.json()
                    signed_url = payload.get("signedURL")
                    if signed_url:
                        # Normalize returned relative signed path
                        if signed_url.startswith("http"):
                            return signed_url
                        return f"{self.supabase_url}/storage/v1{signed_url}"
                else:
                    logger.warning(f"Supabase sign URL returned {resp.status_code}: {resp.text}")
            except Exception as e:
                logger.error(f"Error generating Supabase signed URL: {e}")

        # Fallback to local media URL
        return f"{settings.MEDIA_URL}{clean_path}"

    def delete(self, storage_path: str) -> bool:
        clean_path = storage_path.lstrip('/')
        if self.supabase_url and self.supabase_key:
            try:
                import requests
                headers = {
                    "apikey": self.supabase_key,
                    "Authorization": f"Bearer {self.supabase_key}",
                    "Content-Type": "application/json",
                }
                url = f"{self.supabase_url}/storage/v1/object/{self.bucket}"
                resp = requests.delete(
                    url,
                    headers=headers,
                    json={"prefixes": [clean_path]},
                    verify=self.ssl_verify
                )
                return resp.status_code == 200
            except Exception as e:
                logger.error(f"Error deleting Supabase object: {e}")

        # Fallback to local deletion
        try:
            if default_storage.exists(clean_path):
                default_storage.delete(clean_path)
                return True
        except Exception:
            pass
        return False


def get_storage_driver() -> StorageDriver:
    return SupabaseStorageDriver()
