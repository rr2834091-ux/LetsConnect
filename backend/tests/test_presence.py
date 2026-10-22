from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from apps.presence.models import Presence

class PresenceTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username="p_user@test.com", email="p_user@test.com", password="P1")

    def test_update_status_and_heartbeat(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.post('/api/v1/presence/status/', {
            "status": "dnd",
            "custom_message": "In a client meeting"
        })
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["status"], "dnd")
        self.assertEqual(resp.data["custom_status_message"], "In a client meeting")

        # Heartbeat maintains manual status
        resp_hb = self.client.post('/api/v1/presence/heartbeat/')
        self.assertEqual(resp_hb.status_code, 200)
        self.assertEqual(resp_hb.data["status"], "dnd")
