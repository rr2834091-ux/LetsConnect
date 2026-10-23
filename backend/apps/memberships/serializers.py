from rest_framework import serializers
from .models import Employee, Department, BusinessRole, AdminProfile

class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ['id', 'name', 'code', 'description']

class BusinessRoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = BusinessRole
        fields = ['id', 'name', 'code', 'can_manage_teams', 'can_manage_employees']

class EmployeeSerializer(serializers.ModelSerializer):
    department = DepartmentSerializer(read_only=True)
    role = BusinessRoleSerializer(read_only=True)
    full_name = serializers.SerializerMethodField()
    user_id = serializers.SerializerMethodField()

    class Meta:
        model = Employee
        fields = [
            'id', 'employee_id', 'user_id', 'first_name', 'last_name', 'full_name',
            'email', 'phone', 'job_title', 'department', 'role', 'status'
        ]

    def get_full_name(self, obj):
        return f"{obj.first_name} {obj.last_name}".strip()

    def get_user_id(self, obj):
        from django.contrib.auth.models import User
        u = User.objects.filter(email__iexact=obj.email).first()
        return u.id if u else None
