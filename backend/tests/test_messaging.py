from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from apps.messaging.models import Conversation, Message

class MessagingTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user1 = User.objects.create_user(username="u1@test.com", email="u1@test.com", password="P1")
        self.user2 = User.objects.create_user(username="u2@test.com", email="u2@test.com", password="P2")

    def test_direct_conversation_creation_and_messaging(self):
        self.client.force_authenticate(user=self.user1)
        resp = self.client.post('/api/v1/messaging/conversations/', {
            "conversation_type": "direct",
            "recipient_id": self.user2.id
        })
        self.assertEqual(resp.status_code, 201)
        conv_id = resp.data["id"]

        # Send a message
        resp_msg = self.client.post(f'/api/v1/messaging/conversations/{conv_id}/messages/', {
            "content": "Hello User 2!"
        })
        self.assertEqual(resp_msg.status_code, 201)
        msg_id = resp_msg.data["id"]

        # React to message
        resp_react = self.client.post(f'/api/v1/messaging/messages/{msg_id}/reactions/', {
            "emoji": "👍"
        })
        self.assertEqual(resp_react.status_code, 200)
        self.assertIn("👍", resp_react.data["reactions"])

    def test_threaded_reply(self):
        self.client.force_authenticate(user=self.user1)
        conv = Conversation.objects.create(conversation_type="group", created_by=self.user1)
        parent = Message.objects.create(conversation=conv, sender=self.user1, sender_name="U1", content="Parent")

        resp = self.client.post(f'/api/v1/messaging/conversations/{conv.id}/messages/', {
            "content": "Threaded reply",
            "parent_message_id": str(parent.id)
        })
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(parent.replies.count(), 1)
