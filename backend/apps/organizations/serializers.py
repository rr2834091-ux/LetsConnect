from rest_framework import serializers
from .models import Organization, Workspace, OrganizationSetting

class WorkspaceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Workspace
        fields = ['id', 'name', 'slug', 'custom_domain']

class OrganizationSettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrganizationSetting
        fields = ['allow_guest_access', 'session_timeout_minutes', 'file_upload_limit_mb', 'timezone', 'default_language']

class OrganizationSerializer(serializers.ModelSerializer):
    workspace = WorkspaceSerializer(read_only=True)
    settings = OrganizationSettingSerializer(read_only=True)
    role_in_org = serializers.SerializerMethodField()

    class Meta:
        model = Organization
        fields = [
            'id', 'legal_name', 'display_name', 'company_domain',
            'organization_type', 'industry', 'company_size',
            'is_active', 'workspace', 'settings', 'role_in_org'
        ]

    def get_role_in_org(self, obj):
        user = self.context.get('request').user if 'request' in self.context else None
        if not user or not user.is_authenticated:
            return None
        from apps.memberships.models import Employee, AdminProfile
        # Check admin profile
        if AdminProfile.objects.filter(user=user, organization=obj).exists():
            return "Administrator"
        # Check employee record
        emp = Employee.objects.filter(organization=obj, email__iexact=user.email).first()
        if emp and emp.role:
            return emp.role.name
        elif emp:
            return "Employee"
        return "Member"
