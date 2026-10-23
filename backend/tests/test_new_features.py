from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from apps.organizations.models import Organization
from apps.memberships.models import Employee, Department, BusinessRole
from apps.teams.models import Team
from apps.channels.models import Channel
from apps.messaging.models import Conversation, ConversationParticipant, Message
from apps.presence.models import Presence

class NewFeaturesTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.org = Organization.objects.create(
            display_name="Apex Innovations",
            legal_name="Apex Innovations LLC",
            company_domain="apex.com",
            business_email="admin@apex.com",
            admin_contact_email="admin@apex.com"
        )
        self.user = User.objects.create_user(
            username="alice@apex.com",
            email="alice@apex.com",
            password="Password123!",
            first_name="Alice",
            last_name="Smith"
        )
        self.emp = Employee.objects.create(
            organization=self.org,
            employee_id="EMP_ALICE",
            first_name="Alice",
            last_name="Smith",
            email="alice@apex.com",
            status="active"
        )
        self.client.force_authenticate(user=self.user)

    def test_search_endpoint(self):
        resp = self.client.get(f'/api/v1/search/?q=Alice&organization_id={self.org.id}')
        self.assertEqual(resp.status_code, 200)
        self.assertIn("results", resp.data)
        self.assertIn("people", resp.data["results"])
        self.assertTrue(len(resp.data["results"]["people"]) > 0)
        self.assertEqual(resp.data["results"]["people"][0]["email"], "alice@apex.com")

    def test_member_profile_endpoint(self):
        resp = self.client.get(f'/api/v1/memberships/profile/{self.user.id}/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["email"], "alice@apex.com")
        self.assertEqual(resp.data["full_name"], "Alice Smith")
        self.assertEqual(resp.data["presence_status"], "available")

    def test_group_creation_validation(self):
        # Missing title should fail with 400
        resp = self.client.post('/api/v1/messaging/conversations/', {
            "conversation_type": "group",
            "title": "",
            "participant_ids": [self.user.id]
        })
        self.assertEqual(resp.status_code, 400)
        self.assertIn("Group name is required", resp.data.get("detail", ""))

    def test_team_creation_validation(self):
        from apps.memberships.models import AdminProfile
        AdminProfile.objects.create(user=self.user, organization=self.org)
        # Empty team name should fail with 400
        resp = self.client.post('/api/v1/teams/', {
            "organization": str(self.org.id),
            "name": "   ",
            "visibility": "public"
        })
        self.assertEqual(resp.status_code, 400)

    def test_remove_conversation_for_user(self):
        conv = Conversation.objects.create(
            conversation_type="direct",
            organization=self.org,
            title="Direct Chat",
            created_by=self.user
        )
        part = ConversationParticipant.objects.create(
            conversation=conv,
            user=self.user,
            role="member"
        )
        resp = self.client.post(f'/api/v1/messaging/conversations/{conv.id}/remove-for-user/', {})
        self.assertEqual(resp.status_code, 200)
        part.refresh_from_db()
        self.assertTrue(part.is_hidden)

    def test_account_deactivation(self):
        # Wrong password
        resp = self.client.post('/api/v1/auth/deactivate/', {"password": "WrongPassword!"})
        self.assertEqual(resp.status_code, 400)

        # Correct password
        resp = self.client.post('/api/v1/auth/deactivate/', {"password": "Password123!"})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(
            resp.data["detail"],
            "Thank you for being part of Let's Connect. We wish you a great career ahead."
        )
        self.user.refresh_from_db()
        self.assertFalse(self.user.is_active)
