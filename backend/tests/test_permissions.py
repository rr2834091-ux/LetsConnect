from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from apps.organizations.models import Organization
from apps.memberships.models import Employee, AdminProfile
from apps.teams.models import Team, TeamMembership
from apps.permissions.models import OrganizationPolicy

class PermissionTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.org = Organization.objects.create(
            legal_name="Test Org Ltd",
            display_name="TestOrg",
            company_domain="testorg.com",
            business_email="admin@testorg.com",
            admin_contact_email="admin@testorg.com"
        )
        self.policy = OrganizationPolicy.objects.create(
            organization=self.org,
            team_owner_can_add_users=False,
            team_owner_can_create_teams_channels=False,
            user_can_create_teams_channels=False
        )

        # Team Owner user
        self.user_owner = User.objects.create_user(
            username="owner@testorg.com",
            email="owner@testorg.com",
            password="Password123!"
        )
        self.emp_owner = Employee.objects.create(
            organization=self.org,
            first_name="Owner",
            last_name="User",
            email="owner@testorg.com",
            status="active"
        )

        # Normal Member user
        self.user_member = User.objects.create_user(
            username="member@testorg.com",
            email="member@testorg.com",
            password="Password123!"
        )
        self.emp_member = Employee.objects.create(
            organization=self.org,
            first_name="Member",
            last_name="User",
            email="member@testorg.com",
            status="active"
        )

        # Team
        self.team = Team.objects.create(
            organization=self.org,
            name="Dev Team",
            visibility="public"
        )
        TeamMembership.objects.create(
            team=self.team,
            employee=self.emp_owner,
            role_in_team="owner"
        )

    def test_team_owner_cannot_add_users_when_policy_is_false(self):
        self.client.force_authenticate(user=self.user_owner)
        resp = self.client.post(f'/api/v1/teams/{self.team.id}/members/', {
            "employee_id": str(self.emp_member.id),
            "role": "member"
        })
        self.assertEqual(resp.status_code, 403)

    def test_team_owner_can_add_users_when_policy_is_true(self):
        self.policy.team_owner_can_add_users = True
        self.policy.save()

        self.client.force_authenticate(user=self.user_owner)
        resp = self.client.post(f'/api/v1/teams/{self.team.id}/members/', {
            "employee_id": str(self.emp_member.id),
            "role": "member"
        })
        self.assertEqual(resp.status_code, 201)

    def test_normal_employee_cannot_create_teams_when_policy_is_false(self):
        self.client.force_authenticate(user=self.user_member)
        resp = self.client.post('/api/v1/teams/', {
            "organization": str(self.org.id),
            "name": "Secret Rogue Team",
            "visibility": "public"
        })
        self.assertEqual(resp.status_code, 403)
