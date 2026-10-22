import uuid
from django.db import models

class Organization(models.Model):
    """
    Unmanaged mirror of tc_organizations, owned by Admin Centre.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    legal_name = models.CharField(max_length=255)
    display_name = models.CharField(max_length=255)
    company_domain = models.CharField(max_length=255, blank=True, default="")
    organization_type = models.CharField(max_length=100, blank=True, default="Private Enterprise")
    industry = models.CharField(max_length=100, blank=True, default="Technology")
    company_size = models.CharField(max_length=50, blank=True, default="1-50")
    country = models.CharField(max_length=100, blank=True, default="")
    state = models.CharField(max_length=100, blank=True, default="")
    city = models.CharField(max_length=100, blank=True, default="")
    registered_address = models.TextField(blank=True, default="")
    website = models.URLField(max_length=500, blank=True, default="")
    business_email = models.EmailField()
    business_phone = models.CharField(max_length=50, blank=True, default="")
    admin_name = models.CharField(max_length=255, default="Administrator")
    admin_job_title = models.CharField(max_length=255, blank=True, default="Administrator")
    admin_contact_email = models.EmailField()
    admin_contact_phone = models.CharField(max_length=50, blank=True, default="")
    verification_status = models.CharField(max_length=50, default="Active")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        managed = False
        db_table = "tc_organizations"
        ordering = ["display_name"]

    def __str__(self):
        return f"{self.display_name} ({self.legal_name})"


class Workspace(models.Model):
    """
    Unmanaged mirror of tc_workspaces, owned by Admin Centre.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.OneToOneField(Organization, on_delete=models.CASCADE, related_name="workspace")
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=100, unique=True)
    custom_domain = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        managed = False
        db_table = "tc_workspaces"

    def __str__(self):
        return f"{self.name} [{self.slug}]"


class OrganizationSetting(models.Model):
    """
    Unmanaged mirror of tc_organization_settings, owned by Admin Centre.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.OneToOneField(Organization, on_delete=models.CASCADE, related_name="settings")
    allow_guest_access = models.BooleanField(default=False)
    require_mfa_for_admins = models.BooleanField(default=True)
    session_timeout_minutes = models.PositiveIntegerField(default=60)
    file_upload_limit_mb = models.PositiveIntegerField(default=100)
    default_language = models.CharField(max_length=10, default="en")
    timezone = models.CharField(max_length=50, default="UTC")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        managed = False
        db_table = "tc_organization_settings"

    def __str__(self):
        return f"Settings for {self.organization.display_name}"
