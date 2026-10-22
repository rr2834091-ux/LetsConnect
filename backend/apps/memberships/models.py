import uuid
from django.db import models
from django.contrib.auth.models import User
from apps.organizations.models import Organization

class Department(models.Model):
    """
    Unmanaged mirror of tc_departments.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="departments")
    name = models.CharField(max_length=150)
    code = models.CharField(max_length=50)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        managed = False
        db_table = "tc_departments"
        ordering = ["name"]

    def __str__(self):
        return self.name


class BusinessRole(models.Model):
    """
    Unmanaged mirror of tc_business_roles.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="roles", null=True, blank=True)
    name = models.CharField(max_length=50)
    code = models.CharField(max_length=50)
    description = models.TextField(blank=True)
    is_system_role = models.BooleanField(default=True)
    can_manage_organization = models.BooleanField(default=False)
    can_manage_employees = models.BooleanField(default=False)
    can_manage_teams = models.BooleanField(default=False)
    can_manage_policies = models.BooleanField(default=False)
    can_manage_apps = models.BooleanField(default=False)
    can_view_analytics = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = False
        db_table = "tc_business_roles"
        ordering = ["name"]

    def __str__(self):
        return self.name


class Employee(models.Model):
    """
    Unmanaged mirror of tc_employees.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="employees")
    employee_id = models.CharField(max_length=50, blank=True, default="")
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    email = models.EmailField()
    phone = models.CharField(max_length=50, blank=True, default="")
    job_title = models.CharField(max_length=150, blank=True, default="Member")
    department = models.ForeignKey(Department, on_delete=models.SET_NULL, null=True, blank=True, related_name="employees")
    role = models.ForeignKey(BusinessRole, on_delete=models.SET_NULL, null=True, blank=True, related_name="employees")
    status = models.CharField(max_length=20, default="active")
    hire_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        managed = False
        db_table = "tc_employees"
        ordering = ["last_name", "first_name"]

    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.email})"


class AdminProfile(models.Model):
    """
    Unmanaged mirror of tc_admin_profiles.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="admin_profile")
    organization = models.ForeignKey(Organization, on_delete=models.SET_NULL, null=True, blank=True, related_name="administrators")
    full_name = models.CharField(max_length=255, default="Administrator")
    is_demo_account = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        managed = False
        db_table = "tc_admin_profiles"

    def __str__(self):
        return f"{self.user.username} ({self.full_name})"
