from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from apps.meetings.models import Meeting

class MeetingTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.host = User.objects.create_user(username="host@test.com", email="host@test.com", password="P1")
        self.meeting = Meeting.objects.create(
            title="Sprint Standup",
            room_name="test_standup_room",
            host=self.host,
            passcode="1234",
            allow_guest=True
        )

    def test_join_meeting_authenticated(self):
        self.client.force_authenticate(user=self.host)
        resp = self.client.post('/api/v1/meetings/join/', {
            "meeting_id": self.meeting.room_name,
            "passcode": "1234"
        })
        self.assertEqual(resp.status_code, 200)
        self.assertIn("token", resp.data)
        self.assertEqual(resp.data["role"], "host")

    def test_join_meeting_guest(self):
        # Unauthenticated client joining as guest
        resp = self.client.post('/api/v1/meetings/join/', {
            "meeting_id": self.meeting.room_name,
            "passcode": "1234",
            "guest_name": "Guest Visitor"
        })
        self.assertEqual(resp.status_code, 200)
        self.assertIn("token", resp.data)
        self.assertEqual(resp.data["role"], "attendee")

    def test_invalid_passcode_rejected(self):
        resp = self.client.post('/api/v1/meetings/join/', {
            "meeting_id": self.meeting.room_name,
            "passcode": "wrong_code"
        })
        self.assertEqual(resp.status_code, 403)
