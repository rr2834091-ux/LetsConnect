from rest_framework import generics, permissions, status, exceptions
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db import transaction
from .models import Team, TeamMembership
from .serializers import TeamSerializer, TeamCreateSerializer, TeamMembershipSerializer
from apps.organizations.models import Organization
from apps.memberships.models import Employee, AdminProfile
from apps.channels.models import Channel
from apps.permissions.evaluator import can_create_teams, can_add_team_users, is_team_owner, is_org_admin

class TeamListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return TeamCreateSerializer
        return TeamSerializer

    def get_queryset(self):
        from django.db.models import Q
        user = self.request.user
        org_id = self.request.query_params.get('organization_id') or getattr(self.request, 'active_org_id', None)
        if not org_id:
            raise exceptions.ValidationError({"detail": "organization_id query parameter is required."})

        # Verify membership
        is_member = Employee.objects.filter(
            organization_id=org_id,
            email__iexact=user.email,
            status='active'
        ).exists() or AdminProfile.objects.filter(user=user, organization_id=org_id).exists()

        if not is_member:
            raise exceptions.PermissionDenied("You are not authorized to access teams in this organization.")

        if is_org_admin(user, org_id):
            return Team.objects.filter(organization_id=org_id, is_archived=False)

        emp = Employee.objects.filter(organization_id=org_id, email__iexact=user.email).first()
        my_team_ids = list(TeamMembership.objects.filter(employee=emp).values_list('team_id', flat=True)) if emp else []

        return Team.objects.filter(
            organization_id=org_id,
            is_archived=False
        ).filter(Q(visibility='public') | Q(id__in=my_team_ids)).distinct()

    def create(self, request, *args, **kwargs):
        org_id = request.data.get('organization')
        if not org_id:
            return Response({"detail": "organization field is required."}, status=status.HTTP_400_BAD_REQUEST)

        # Check explicit permission
        if not can_create_teams(request.user, org_id):
            return Response(
                {"detail": "You do not have permission to create teams in this organization."},
                status=status.HTTP_403_FORBIDDEN
            )

        with transaction.atomic():
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            team = serializer.save()

            # Create default #general channel
            general_channel = Channel.objects.create(
                team=team,
                name="general",
                description="General team discussion",
                channel_type="standard"
            )

            # Assign user as team owner if they have an employee record
            emp = Employee.objects.filter(organization_id=org_id, email__iexact=request.user.email).first()
            if emp:
                TeamMembership.objects.create(
                    team=team,
                    employee=emp,
                    role_in_team='owner'
                )

            # Automatically create backing conversation in LetsConnect for #general channel
            from apps.messaging.models import Conversation
            Conversation.objects.create(
                conversation_type='channel',
                organization_id=org_id,
                channel=general_channel,
                title=f"#{general_channel.name}",
                created_by=request.user
            )

            read_serializer = TeamSerializer(team, context={'request': request})
            return Response(read_serializer.data, status=status.HTTP_201_CREATED)


class TeamDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = TeamSerializer
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
        my_org_ids = set(list(emp_org_ids) + list(admin_org_ids))

        from django.db.models import Q
        my_team_ids = TeamMembership.objects.filter(
            employee__email__iexact=user.email,
            employee__status='active'
        ).values_list('team_id', flat=True)

        return Team.objects.filter(organization_id__in=my_org_ids).filter(
            Q(organization_id__in=admin_org_ids) | Q(visibility='public') | Q(id__in=my_team_ids)
        ).distinct()

    def perform_destroy(self, instance):
        if not is_team_owner(self.request.user, instance.id):
            raise exceptions.PermissionDenied("Only a team owner or admin can archive or remove a team.")
        instance.is_archived = True
        instance.save()


class TeamMembersView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, id):
        try:
            team = Team.objects.get(id=id)
        except Team.DoesNotExist:
            return Response({"detail": "Team not found"}, status=status.HTTP_404_NOT_FOUND)

        memberships = TeamMembership.objects.filter(team=team).select_related('employee', 'employee__role', 'employee__department')
        serializer = TeamMembershipSerializer(memberships, many=True)
        return Response(serializer.data)

    def post(self, request, id):
        """
        Add a member to the team. Enforces can_add_team_users explicit check.
        """
        try:
            team = Team.objects.get(id=id)
        except Team.DoesNotExist:
            return Response({"detail": "Team not found"}, status=status.HTTP_404_NOT_FOUND)

        if not can_add_team_users(request.user, team.id):
            return Response(
                {"detail": "You do not have permission to add members to this team."},
                status=status.HTTP_403_FORBIDDEN
            )

        employee_id = request.data.get('employee_id')
        role = request.data.get('role', 'member')
        if not employee_id:
            return Response({"detail": "employee_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            employee = Employee.objects.get(id=employee_id, organization=team.organization)
        except Employee.DoesNotExist:
            return Response({"detail": "Employee does not belong to this organization."}, status=status.HTTP_400_BAD_REQUEST)

        membership, created = TeamMembership.objects.get_or_create(
            team=team,
            employee=employee,
            defaults={'role_in_team': role}
        )
        if not created and membership.role_in_team != role:
            membership.role_in_team = role
            membership.save()

        serializer = TeamMembershipSerializer(membership)
        return Response(serializer.data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    def delete(self, request, id):
        """
        Remove a member from the team.
        """
        try:
            team = Team.objects.get(id=id)
        except Team.DoesNotExist:
            return Response({"detail": "Team not found"}, status=status.HTTP_404_NOT_FOUND)

        if not is_team_owner(request.user, team.id):
            return Response({"detail": "Only team owners or org admins can remove team members."}, status=status.HTTP_403_FORBIDDEN)

        employee_id = request.data.get('employee_id')
        TeamMembership.objects.filter(team=team, employee_id=employee_id).delete()
        return Response({"detail": "Member removed from team."}, status=status.HTTP_200_OK)
