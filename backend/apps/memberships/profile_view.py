import uuid
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, status
from django.contrib.auth.models import User
from apps.memberships.models import Employee, AdminProfile
from apps.presence.models import Presence

class MemberProfileDetailView(APIView):
    """
    Returns complete profile information for a member or colleague:
    - User details (ID, names, email, username)
    - Corporate employee details (job title, department, business role, employee ID)
    - Real-time presence & custom status message
    - Personal bio if set
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, identifier=None):
        target_id = identifier or request.query_params.get('id') or request.query_params.get('user_id') or request.query_params.get('email')
        if not target_id:
            return Response({"detail": "User or employee identifier is required."}, status=status.HTTP_400_BAD_REQUEST)

        emp = None
        user = None

        # Try match as UUID (Employee id or PersonalProfile id)
        try:
            val_uuid = uuid.UUID(str(target_id))
            emp = Employee.objects.filter(id=val_uuid).select_related('department', 'role', 'organization').first()
        except (ValueError, AttributeError):
            pass

        # Try match as integer User ID
        if not emp:
            try:
                val_int = int(target_id)
                user = User.objects.filter(id=val_int).first()
            except (ValueError, TypeError):
                pass

        # Try match as email or username
        if not user and not emp:
            user = User.objects.filter(email__iexact=str(target_id)).first()
            if not user:
                user = User.objects.filter(username__iexact=str(target_id)).first()

        # Correlate User and Employee
        if user and not emp:
            emp = Employee.objects.filter(email__iexact=user.email).select_related('department', 'role', 'organization').first()
        elif emp and not user:
            user = User.objects.filter(email__iexact=emp.email).first()

        if not user and not emp:
            return Response({"detail": "Member profile not found."}, status=status.HTTP_404_NOT_FOUND)

        # Presence info
        presence = None
        if user:
            presence = Presence.objects.filter(user=user).first()

        bio = ""

        first_name = emp.first_name if emp else (user.first_name if user else "")
        last_name = emp.last_name if emp else (user.last_name if user else "")
        full_name = f"{first_name} {last_name}".strip() or (user.username if user else "Member")
        email = emp.email if emp else (user.email if user else "")

        return Response({
            "user_id": user.id if user else None,
            "employee_id": str(emp.id) if emp else None,
            "corporate_id": emp.employee_id if emp else "",
            "full_name": full_name,
            "first_name": first_name,
            "last_name": last_name,
            "email": email,
            "phone": emp.phone if emp else "",
            "job_title": emp.job_title if (emp and emp.job_title) else "Team Member",
            "department": emp.department.name if (emp and emp.department) else "General",
            "role": emp.role.name if (emp and emp.role) else "Member",
            "organization_id": str(emp.organization_id) if emp else None,
            "presence_status": presence.status if presence else "available",
            "custom_status": presence.custom_status_message if presence else "",
            "bio": bio,
        })
