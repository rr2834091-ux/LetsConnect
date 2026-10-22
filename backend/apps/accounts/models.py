import hashlib
import secrets
import uuid
from datetime import timedelta
from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
from apps.organizations.models import Organization

class EmailVerificationOTP(models.Model):
    """
    Direct mapping to tc_email_verification_otps in Supabase.
    """
    PURPOSE_REGISTRATION = "registration"
    PURPOSE_PASSWORD_RESET = "password_reset"
    PURPOSE_WORK_SETUP = "work_setup"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(db_index=True)
    otp_hash = models.CharField(max_length=128)
    purpose = models.CharField(max_length=32)
    attempts = models.PositiveIntegerField(default=0)
    is_verified = models.BooleanField(default=False)
    reset_token = models.CharField(max_length=128, blank=True, default="", db_index=True)
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    metadata = models.JSONField(default=dict, blank=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True, related_name="verification_otps")

    class Meta:
        managed = False
        db_table = "tc_email_verification_otps"
        ordering = ["-created_at"]

    @staticmethod
    def hash_code(email: str, code: str, purpose: str) -> str:
        payload = f"{email.lower().strip()}:{code.strip()}:{purpose}"
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()

    def set_otp(self, code: str):
        self.otp_hash = self.hash_code(self.email, code, self.purpose)
        self.expires_at = timezone.now() + timedelta(minutes=10)
        self.attempts = 0
        self.is_verified = False

    def verify_otp(self, code: str) -> tuple[bool, str]:
        if self.is_verified:
            return False, "This verification code has already been used."

        if timezone.now() > self.expires_at:
            return False, "Verification code has expired. Please request a new one."

        if self.attempts >= 5:
            return False, "Too many failed attempts. Please request a new verification code."

        self.attempts += 1
        expected_hash = self.hash_code(self.email, code, self.purpose)

        if secrets.compare_digest(self.otp_hash, expected_hash):
            self.is_verified = True
            self.reset_token = secrets.token_urlsafe(32)
            self.save(update_fields=["attempts", "is_verified", "reset_token"])
            return True, "Code verified successfully."

        self.save(update_fields=["attempts"])
        remaining = max(0, 5 - self.attempts)
        return False, f"Invalid verification code. {remaining} attempt(s) remaining."


class UserPreference(models.Model):
    """
    Additive LetsConnect user preferences and active context tracking.
    """
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="lc_preferences")
    theme = models.CharField(max_length=20, default="dark", choices=[("dark", "Dark"), ("light", "Light"), ("system", "System")])
    active_context = models.CharField(max_length=20, default="work", choices=[("work", "Work"), ("personal", "Personal")])
    active_organization = models.ForeignKey(Organization, on_delete=models.SET_NULL, null=True, blank=True, related_name="active_users")
    notification_settings = models.JSONField(default=dict, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        managed = True
        db_table = "lc_user_preferences"

    def __str__(self):
        return f"Preferences for {self.user.username} ({self.active_context})"
