import logging
from .models import Notification
from .serializers import NotificationSerializer

logger = logging.getLogger(__name__)

def create_notification(user, notification_type: str, title: str, body: str, organization=None, data=None):
    """
    Persist an in-app notification for a user and broadcast it in real time via WebSockets.
    """
    try:
        notif = Notification.objects.create(
            user=user,
            organization=organization,
            notification_type=notification_type,
            title=title,
            body=body,
            data=data or {}
        )

        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        channel_layer = get_channel_layer()
        if channel_layer:
            payload = NotificationSerializer(notif).data
            async_to_sync(channel_layer.group_send)(
                f"user_{user.id}",
                {
                    "type": "new_notification",
                    "notification": payload
                }
            )
        return notif
    except Exception as e:
        logger.warning(f"Failed to create notification for user {getattr(user, 'id', None)}: {e}")
        return None
