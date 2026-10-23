from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from unittest.mock import patch, MagicMock
from apps.organizations.models import Organization
from apps.memberships.models import Employee
from apps.accounts.models import EmailVerificationOTP

class AuthTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.org = Organization.objects.create(
            legal_name="Acme Corp",
            display_name="Acme",
            company_domain="acme.com",
            business_email="admin@acme.com",
            admin_contact_email="admin@acme.com"
        )
        self.emp = Employee.objects.create(
            organization=self.org,
            employee_id="EMP_JANE",
            first_name="Jane",
            last_name="Doe",
            email="jane@acme.com",
            status="active"
        )

    def test_personal_registration_and_login(self):
        resp = self.client.post('/api/v1/auth/register-personal/', {
            "email": "personal_user@gmail.com",
            "password": "Password123!",
            "first_name": "Personal",
            "last_name": "User"
        })
        self.assertEqual(resp.status_code, 201)
        self.assertIn("token", resp.data)

        # Login as personal
        resp_login = self.client.post('/api/v1/auth/login/', {
            "email": "personal_user@gmail.com",
            "password": "Password123!",
            "context": "personal"
        })
        self.assertEqual(resp_login.status_code, 200)
        self.assertEqual(resp_login.data["active_context"], "personal")

    def test_work_setup_check(self):
        # Eligible work email
        resp = self.client.post('/api/v1/auth/work-setup-check/', {
            "email": "jane@acme.com"
        })
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.data["eligible"])

        # Ineligible non-provisioned email
        resp_invalid = self.client.post('/api/v1/auth/work-setup-check/', {
            "email": "uninvited@unknown.com"
        })
        self.assertEqual(resp_invalid.status_code, 404)

    def test_otp_flow_and_expiration(self):
        otp = EmailVerificationOTP(email="jane@acme.com", purpose="work_setup")
        otp.set_otp("654321")
        otp.save()

        # Wrong code
        valid, msg = otp.verify_otp("111111")
        self.assertFalse(valid)
        self.assertEqual(otp.attempts, 1)

        # Correct code
        valid, msg = otp.verify_otp("654321")
        self.assertTrue(valid)
        self.assertTrue(otp.is_verified)
        self.assertTrue(len(otp.reset_token) > 0)

    def test_login_unknown_user_rejected(self):
        resp = self.client.post('/api/v1/auth/login/', {
            "email": "nonexistent_stranger@unknown.com",
            "password": "Password123!",
            "context": "work"
        })
        self.assertEqual(resp.status_code, 401)
        self.assertEqual(resp.data.get("detail"), "Invalid email or password.")

    def test_login_incorrect_password_rejected(self):
        User.objects.create_user(
            username="known_user@acme.com",
            email="known_user@acme.com",
            password="CorrectPassword123!"
        )
        resp = self.client.post('/api/v1/auth/login/', {
            "email": "known_user@acme.com",
            "password": "WrongPassword999!",
            "context": "work"
        })
        self.assertEqual(resp.status_code, 401)
        self.assertEqual(resp.data.get("detail"), "Invalid email or password.")

    def test_login_work_account_without_org_rejected(self):
        User.objects.create_user(
            username="no_org_user@gmail.com",
            email="no_org_user@gmail.com",
            password="Password123!"
        )
        resp = self.client.post('/api/v1/auth/login/', {
            "email": "no_org_user@gmail.com",
            "password": "Password123!",
            "context": "work"
        })
        self.assertEqual(resp.status_code, 403)
        self.assertIn("No active organization membership", resp.data.get("detail", ""))

    def test_login_work_account_with_org_success(self):
        user = User.objects.create_user(
            username="jane@acme.com",
            email="jane@acme.com",
            password="Password123!"
        )
        resp = self.client.post('/api/v1/auth/login/', {
            "email": "jane@acme.com",
            "password": "Password123!",
            "context": "work"
        })
        self.assertEqual(resp.status_code, 200)
        self.assertIn("token", resp.data)
        self.assertEqual(resp.data["active_context"], "work")
        self.assertIsNotNone(resp.data["active_organization"])
        self.assertEqual(str(resp.data["active_organization"]["id"]), str(self.org.id))

    def test_login_provisioned_employee_triggers_first_time_setup(self):
        # emp 'jane@acme.com' exists in Employee table, but if auth_user doesn't exist yet:
        Employee.objects.create(
            organization=self.org,
            employee_id="EMP_BOB",
            first_name="Bob",
            last_name="Smith",
            email="bob@acme.com",
            status="active"
        )
        resp = self.client.post('/api/v1/auth/login/', {
            "email": "bob@acme.com",
            "password": "AnyRandomPassword123!",
            "context": "work"
        })
        self.assertEqual(resp.status_code, 403)
        self.assertTrue(resp.data.get("requires_first_time_setup"))
        self.assertEqual(resp.data.get("email"), "bob@acme.com")

    def test_google_config_endpoint(self):
        resp = self.client.get('/api/v1/auth/google/config/')
        self.assertEqual(resp.status_code, 200)
        self.assertIn("client_id", resp.data)
        self.assertIn("configured", resp.data)

    def test_google_auth_missing_id_token(self):
        resp = self.client.post('/api/v1/auth/google/', {})
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.data.get("detail"), "Google ID token or access token is required.")

    @patch('requests.get')
    def test_google_auth_invalid_token(self, mock_get):
        mock_resp = MagicMock()
        mock_resp.status_code = 400
        mock_get.return_value = mock_resp

        resp = self.client.post('/api/v1/auth/google/', {"id_token": "invalid_raw_token"})
        self.assertEqual(resp.status_code, 400)
        self.assertIn("Invalid Google OAuth ID token", resp.data.get("detail", ""))

    @patch('requests.get')
    def test_google_auth_audience_mismatch(self, mock_get):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "aud": "attacker-client-id.apps.googleusercontent.com",
            "email": "user@gmail.com",
            "email_verified": "true",
            "given_name": "Google",
            "family_name": "User"
        }
        mock_get.return_value = mock_resp

        with self.settings(GOOGLE_CLIENT_ID="expected-client-id.apps.googleusercontent.com"):
            resp = self.client.post('/api/v1/auth/google/', {"id_token": "mock_id_token"})
            self.assertEqual(resp.status_code, 400)
            self.assertEqual(resp.data.get("detail"), "Google token audience mismatch.")

    @patch('requests.get')
    def test_google_auth_unverified_email(self, mock_get):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "aud": "my-client-id",
            "email": "unverified@gmail.com",
            "email_verified": "false",
            "given_name": "Unverified",
            "family_name": "Person"
        }
        mock_get.return_value = mock_resp

        with self.settings(GOOGLE_CLIENT_ID="my-client-id"):
            resp = self.client.post('/api/v1/auth/google/', {"id_token": "mock_id_token"})
            self.assertEqual(resp.status_code, 400)
            self.assertEqual(resp.data.get("detail"), "Google account email is not verified.")

    @patch('requests.get')
    def test_google_auth_success(self, mock_get):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "aud": "valid-client-id",
            "email": "googler@gmail.com",
            "email_verified": "true",
            "given_name": "Google",
            "family_name": "Explorer"
        }
        mock_get.return_value = mock_resp

        with self.settings(GOOGLE_CLIENT_ID="valid-client-id"):
            resp = self.client.post('/api/v1/auth/google/', {"id_token": "valid_token_xyz"})
            self.assertEqual(resp.status_code, 200)
            self.assertIn("token", resp.data)
            self.assertEqual(resp.data["active_context"], "personal")
            self.assertEqual(resp.data["user"]["email"], "googler@gmail.com")
            self.assertEqual(resp.data["user"]["first_name"], "Google")

            # Verify user exists in database and has personal preference
            user = User.objects.filter(email="googler@gmail.com").first()
            self.assertIsNotNone(user)
            self.assertEqual(user.lc_preferences.active_context, "personal")
