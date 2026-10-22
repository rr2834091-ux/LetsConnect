from apps.memberships.models import Employee, AdminProfile

class TenantContextMiddleware:
    """
    Validates tenant context on every request to prevent cross-tenant leakage.
    Sets request.active_org_id and request.active_context.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request.active_org_id = None
        request.active_context = "personal"

        if request.user and request.user.is_authenticated:
            # Check user preference first
            pref = getattr(request.user, 'lc_preferences', None)
            if pref:
                request.active_context = pref.active_context
                if pref.active_organization_id:
                    request.active_org_id = str(pref.active_organization_id)

            # Header override if provided by client
            org_header = request.headers.get('X-Organization-Id') or request.GET.get('organization_id')
            if org_header:
                # Security validation: verify user belongs to this org
                is_valid = Employee.objects.filter(
                    organization_id=org_header,
                    email__iexact=request.user.email,
                    status='active'
                ).exists() or AdminProfile.objects.filter(
                    user=request.user,
                    organization_id=org_header
                ).exists()

                if is_valid:
                    request.active_org_id = org_header
                    request.active_context = "work"

        return self.get_response(request)
