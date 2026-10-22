from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions
from .evaluator import get_user_org_permissions

class UserPermissionsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        org_id = request.query_params.get('organization_id')
        if not org_id:
            return Response({"detail": "organization_id is required"}, status=400)
        perms = get_user_org_permissions(request.user, org_id)
        return Response(perms)
