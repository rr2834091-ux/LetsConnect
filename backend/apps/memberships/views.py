from rest_framework import generics, permissions, exceptions
from django.db.models import Q
from .models import Employee
from .serializers import EmployeeSerializer
from apps.organizations.models import Organization

class EmployeeDirectoryListView(generics.ListAPIView):
    """
    List members/employees in the active organization directory.
    Strictly isolated: requires the user to belong to the requested organization.
    """
    serializer_class = EmployeeSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        org_id = self.request.query_params.get('organization_id') or getattr(self.request, 'active_org_id', None)
        if not org_id:
            raise exceptions.ValidationError({"detail": "organization_id query parameter is required."})

        # Validate that requesting user is a member of this organization
        is_member = Employee.objects.filter(
            organization_id=org_id,
            email__iexact=user.email,
            status='active'
        ).exists() or hasattr(user, 'admin_profile') and str(user.admin_profile.organization_id) == str(org_id)

        if not is_member:
            raise exceptions.PermissionDenied("You are not authorized to view the member directory of this organization.")

        qs = Employee.objects.filter(organization_id=org_id, status='active')
        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search) |
                Q(email__icontains=search) |
                Q(job_title__icontains=search)
            )
        return qs


class EmployeeDetailView(generics.RetrieveAPIView):
    """
    Retrieve employee profile details.
    """
    serializer_class = EmployeeSerializer
    permission_classes = [permissions.IsAuthenticated]
    lookup_field = 'id'

    def get_queryset(self):
        user = self.request.user
        from .models import AdminProfile
        emp_org_ids = Employee.objects.filter(
            email__iexact=user.email,
            status='active'
        ).values_list('organization_id', flat=True)
        admin_org_ids = AdminProfile.objects.filter(
            user=user
        ).values_list('organization_id', flat=True)
        my_org_ids = set(list(emp_org_ids) + list(admin_org_ids))
        return Employee.objects.filter(organization_id__in=my_org_ids)
