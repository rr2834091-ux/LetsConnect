from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db.models import Q
from .models import Organization
from .serializers import OrganizationSerializer
from apps.memberships.models import Employee, AdminProfile
from apps.permissions.models import OrganizationPolicy

class OrganizationListView(generics.ListAPIView):
    """
    List all organizations the authenticated user belongs to
    (either as an employee or as an organization administrator).
    """
    serializer_class = OrganizationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        # Find orgs via tc_employees matching user's email
        emp_org_ids = Employee.objects.filter(
            email__iexact=user.email,
            status='active'
        ).values_list('organization_id', flat=True)

        # Find orgs via tc_admin_profiles
        admin_org_ids = AdminProfile.objects.filter(
            user=user
        ).values_list('organization_id', flat=True)

        all_org_ids = set(list(emp_org_ids) + list(admin_org_ids))
        return Organization.objects.filter(id__in=all_org_ids, is_active=True).distinct()


class OrganizationDetailView(generics.RetrieveAPIView):
    """
    Retrieve details for a specific organization, with tenant boundary check.
    """
    serializer_class = OrganizationSerializer
    permission_classes = [permissions.IsAuthenticated]
    lookup_field = 'id'

    def get_queryset(self):
        user = self.request.user
        emp_org_ids = Employee.objects.filter(
            email__iexact=user.email,
            status='active'
        ).values_list('organization_id', flat=True)
        admin_org_ids = AdminProfile.objects.filter(
            user=user
        ).values_list('organization_id', flat=True)
        all_org_ids = set(list(emp_org_ids) + list(admin_org_ids))
        return Organization.objects.filter(id__in=all_org_ids)


class OrganizationPermissionsView(APIView):
    """
    Returns effective permissions of the user in this organization.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, id):
        user = request.user
        from apps.permissions.evaluator import get_user_org_permissions
        perms = get_user_org_permissions(user, id)
        return Response(perms)
