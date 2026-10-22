# LetsConnect — Future AWS Migration Roadmap

## 1. Migration Strategy Overview

LetsConnect is architected with cloud-native abstractions so that migrating from Supabase to native AWS infrastructure requires **zero structural code redesign**.

---

## 2. Infrastructure Mapping

| Supabase Component | Target AWS Infrastructure | Migration Mechanics |
| :--- | :--- | :--- |
| **PostgreSQL Database** | **Amazon Aurora PostgreSQL** (Serverless v2 or Multi-AZ) | Use `pg_dump` and `pg_restore` or AWS Database Migration Service (DMS) for CDC. |
| **Storage Buckets** | **Amazon S3** + **Amazon CloudFront** | Swap storage adapter in `backend/apps/files/storage.py` to `S3Boto3Storage`. |
| **WebSockets / Channels** | **Amazon ElastiCache Redis** | Configure `CHANNEL_LAYERS` in `settings.py` to use `channels_redis.core.RedisChannelLayer`. |
| **Container Compute** | **AWS ECS (Fargate)** or **AWS EKS** | Deploy Daphne ASGI container behind an Application Load Balancer (ALB). |
| **Web Frontend** | **AWS Amplify Hosting** or **S3 + CloudFront** | Upload static build bundle (`web/dist/`). |
| **Identity & Auth** | **Amazon Cognito User Pools** (Optional) | Can continue standard Django Auth or integrate Cognito JWT verifier. |

---

## 3. Storage Abstraction Layer

The file storage subsystem in LetsConnect uses an interface-based driver pattern:
```python
class StorageDriver(ABC):
    @abstractmethod
    def upload_file(self, file_obj, path: str) -> str: ...
    @abstractmethod
    def get_download_url(self, path: str, expires_in: int) -> str: ...
```
By switching `STORAGE_BACKEND = "s3"` in `settings.py` and providing AWS credentials (`AWS_STORAGE_BUCKET_NAME`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`), file operations redirect to Amazon S3 with zero API contract changes.
