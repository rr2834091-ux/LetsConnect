import uuid
from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from apps.organizations.models import Organization
from apps.memberships.models import Employee, BusinessRole
from apps.teams.models import Team, TeamMembership
from apps.permissions.models import OrganizationPolicy

class MultiOrganizationTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Create two distinct organizations dynamically
        self.org_a = Organization.objects.create(
            legal_name="Alpha Corp Ltd",
            display_name="Alpha",
            company_domain="alphacorp.io",
            business_email="admin@alphacorp.io",
            admin_contact_email="admin@alphacorp.io"
        )
        self.org_b = Organization.objects.create(
            legal_name="Beta Innovations Inc",
            display_name="Beta",
            company_domain="betainno.com",
            business_email="admin@betainno.com",
            admin_contact_email="admin@betainno.com"
        )

        # Create employees
        self.user_a = User.objects.create_user(
            username="alice@alphacorp.io",
            email="alice@alphacorp.io",
            password="Password123!"
        )
        self.emp_a = Employee.objects.create(
            organization=self.org_a,
            first_name="Alice",
            last_name="Alpha",
            email="alice@alphacorp.io",
            status="active"
        )

        self.user_b = User.objects.create_user(
            username="bob@betainno.com",
            email="bob@betainno.com",
            password="Password123!"
        )
        self.emp_b = Employee.objects.create(
            organization=self.org_b,
            first_name="Bob",
            last_name="Beta",
            email="bob@betainno.com",
            status="active"
        )

        # Teams in Org A and Org B
        self.team_a = Team.objects.create(
            organization=self.org_a,
            name="Alpha Engineering",
            visibility="public"
        )
        self.team_b = Team.objects.create(
            organization=self.org_b,
            name="Beta Marketing",
            visibility="public"
        )

    def test_user_only_sees_their_organization(self):
        self.client.force_authenticate(user=self.user_a)
        resp = self.client.get('/api/v1/organizations/')
        self.assertEqual(resp.status_code, 200)
        items = resp.data.get('results', resp.data) if isinstance(resp.data, dict) else resp.data
        org_ids = [o['id'] for o in items]
        self.assertIn(str(self.org_a.id), org_ids)
        self.assertNotIn(str(self.org_b.id), org_ids)

    def test_cross_organization_teams_isolation(self):
        # User A attempts to view teams from Org B
        self.client.force_authenticate(user=self.user_a)
        resp = self.client.get(f'/api/v1/teams/?organization_id={self.org_b.id}')
        # Should be forbidden
        self.assertEqual(resp.status_code, 403)

    def test_dynamic_organization_c_support_without_code_changes(self):
        # Admin Centre creates Org C later
        org_c = Organization.objects.create(
            legal_name="Gamma Global Corp",
            display_name="Gamma",
            company_domain="gamma.com",
            business_email="admin@gamma.com",
            admin_contact_email="admin@gamma.com"
        )
        emp_c = Employee.objects.create(
            organization=org_c,
            first_name="Charlie",
            last_name="Gamma",
            email="charlie@gamma.com",
            status="active"
        )
        user_c = User.objects.create_user(
            username="charlie@gamma.com",
            email="charlie@gamma.com",
            password="Password123!"
        )

        self.client.force_authenticate(user=user_c)
        resp = self.client.get('/api/v1/organizations/')
        self.assertEqual(resp.status_code, 200)
        items = resp.data.get('results', resp.data) if isinstance(resp.data, dict) else resp.data
        org_ids = [o['id'] for o in items]
        self.assertIn(str(org_c.id), org_ids)
        self.assertNotIn(str(self.org_a.id), org_ids)
