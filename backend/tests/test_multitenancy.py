import uuid
import io
from unittest.mock import patch, MagicMock
from django.test import TestCase
from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from apps.organizations.models import Organization
from apps.memberships.models import Employee, BusinessRole
from apps.teams.models import Team
from apps.channels.models import Channel
from apps.meetings.models import Meeting
from apps.files.models import FileAttachment
from apps.files.storage import SupabaseStorageDriver

class MultiTenancyIsolationTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # 1. Create two distinct organisations
        self.org_a = Organization.objects.create(
            legal_name="Acme Corporation",
            display_name="Acme",
            company_domain="acme.com",
            business_email="contact@acme.com",
            admin_contact_email="admin@acme.com"
        )
        self.org_b = Organization.objects.create(
            legal_name="Globex Industries",
            display_name="Globex",
            company_domain="globex.com",
            business_email="contact@globex.com",
            admin_contact_email="admin@globex.com"
        )

        # 2. Create users and employees in separate organisations
        self.user_a = User.objects.create_user(
            username="alice@acme.com",
            email="alice@acme.com",
            first_name="Alice",
            last_name="Acme",
            password="Password123!"
        )
        self.emp_a = Employee.objects.create(
            organization=self.org_a,
            first_name="Alice",
            last_name="Acme",
            email="alice@acme.com",
            status="active"
        )

        self.user_b = User.objects.create_user(
            username="bob@globex.com",
            email="bob@globex.com",
            first_name="Bob",
            last_name="Globex",
            password="Password123!"
        )
        self.emp_b = Employee.objects.create(
            organization=self.org_b,
            first_name="Bob",
            last_name="Globex",
            email="bob@globex.com",
            status="active"
        )

        # 3. Create Teams and Channels in Org A and Org B
        self.team_a = Team.objects.create(
            organization=self.org_a,
            name="Acme R&D",
            visibility="public"
        )
        self.channel_a = Channel.objects.create(
            team=self.team_a,
            name="general",
            channel_type="public"
        )

        self.team_b = Team.objects.create(
            organization=self.org_b,
            name="Globex Sales",
            visibility="public"
        )
        self.channel_b = Channel.objects.create(
            team=self.team_b,
            name="deals",
            channel_type="public"
        )

        # 4. Create Meetings in Org A and Org B
        self.meeting_a = Meeting.objects.create(
            organization=self.org_a,
            title="Acme Sprint Review",
            room_name="acme-sprint-review",
            host=self.user_a,
            is_ended=False,
            scheduled_start="2026-10-25T10:00:00Z",
            scheduled_end="2026-10-25T11:00:00Z"
        )
        self.meeting_b = Meeting.objects.create(
            organization=self.org_b,
            title="Globex Quarterly Review",
            room_name="globex-quarterly-review",
            host=self.user_b,
            is_ended=False,
            scheduled_start="2026-10-25T14:00:00Z",
            scheduled_end="2026-10-25T15:00:00Z"
        )

        # 5. Create a file attachment belonging to Org B
        self.file_b = FileAttachment.objects.create(
            organization=self.org_b,
            uploader=self.user_b,
            filename="globex_q3_report.pdf",
            file_size=2048,
            mime_type="application/pdf",
            storage_provider="supabase",
            storage_path=f"organisations/{self.org_b.id}/attachments/test1234/globex_q3_report.pdf"
        )

    def test_organization_discovery_isolation(self):
        """User A sees only Org A, not Org B."""
        self.client.force_authenticate(user=self.user_a)
        resp = self.client.get('/api/v1/organizations/')
        self.assertEqual(resp.status_code, 200)
        items = resp.data.get('results', resp.data) if isinstance(resp.data, dict) else resp.data
        org_ids = [str(o['id']) for o in items]
        self.assertIn(str(self.org_a.id), org_ids)
        self.assertNotIn(str(self.org_b.id), org_ids)

    def test_teams_cross_tenant_denial(self):
        """User A querying Org B teams returns 403 Forbidden."""
        self.client.force_authenticate(user=self.user_a)
        resp = self.client.get(f'/api/v1/teams/?organization_id={self.org_b.id}')
        self.assertEqual(resp.status_code, 403)

    def test_file_upload_cross_tenant_forbidden(self):
        """User A cannot upload a file to Org B (ID tampering in request payload)."""
        self.client.force_authenticate(user=self.user_a)
        test_file = SimpleUploadedFile("confidential.pdf", b"%PDF-1.4 test", content_type="application/pdf")
        resp = self.client.post('/api/v1/files/upload/', {
            'file': test_file,
            'organization_id': str(self.org_b.id)
        }, format='multipart')
        self.assertEqual(resp.status_code, 403)
        self.assertIn("not authorized", str(resp.data.get("detail", "")).lower())

    def test_file_download_cross_tenant_forbidden(self):
        """User A cannot download files belonging to Org B."""
        self.client.force_authenticate(user=self.user_a)
        resp = self.client.get(f'/api/v1/files/{self.file_b.id}/download/')
        self.assertEqual(resp.status_code, 403)

    def test_file_list_cross_tenant_forbidden(self):
        """User A cannot query the files list of Org B."""
        self.client.force_authenticate(user=self.user_a)
        resp = self.client.get(f'/api/v1/files/?organization_id={self.org_b.id}')
        self.assertEqual(resp.status_code, 403)

    @patch('apps.files.views.get_storage_driver')
    def test_file_upload_scoped_storage_path(self, mock_storage_driver):
        """User A uploading file to Org A generates properly scoped path organisations/{org_id}/attachments/..."""
        mock_driver_instance = MagicMock()
        mock_driver_instance.upload.side_effect = lambda f, dest, **kwargs: dest
        mock_storage_driver.return_value = mock_driver_instance

        self.client.force_authenticate(user=self.user_a)
        test_file = SimpleUploadedFile("spec.pdf", b"%PDF-1.4 spec", content_type="application/pdf")
        resp = self.client.post('/api/v1/files/upload/', {
            'file': test_file,
            'organization_id': str(self.org_a.id)
        }, format='multipart')
        self.assertEqual(resp.status_code, 201)

        uploaded_file = FileAttachment.objects.get(id=resp.data['id'])
        self.assertEqual(uploaded_file.organization_id, self.org_a.id)
        self.assertTrue(uploaded_file.storage_path.startswith(f"organisations/{self.org_a.id}/attachments/"))

    @patch('requests.post')
    def test_supabase_storage_signed_url_generation(self, mock_post):
        """Supabase driver requests signed URL with 3600 second expiry."""
        mock_post.return_value.status_code = 200
        mock_post.return_value.json.return_value = {"signedURL": "/object/sign/file_storage/organisations/test?token=abc"}

        driver = SupabaseStorageDriver()
        driver.supabase_url = "https://mock.supabase.co"
        driver.supabase_key = "mock_key"
        driver.bucket = "file_storage"

        signed_url = driver.get_signed_url("organisations/org_123/attachments/file_abc/doc.pdf", expires_in=3600)
        self.assertIn("token=abc", signed_url)
        self.assertTrue(signed_url.startswith("https://mock.supabase.co/storage/v1"))
