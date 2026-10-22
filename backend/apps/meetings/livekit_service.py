import time
from datetime import timedelta
from django.conf import settings

def generate_livekit_token(
    room_name: str,
    identity: str,
    name: str,
    is_host: bool = False,
    expires_in_seconds: int = 3600
) -> str:
    """
    Generate a cryptographically signed, short-lived LiveKit Cloud access token.
    Uses official livekit.api SDK to guarantee standard compliance with LiveKit Cloud.
    """
    try:
        from livekit.api import AccessToken, VideoGrants
        grants = VideoGrants(
            room_join=True,
            room=room_name,
            can_publish=True,
            can_subscribe=True,
            can_publish_data=True,
            room_admin=is_host,
        )
        token = (
            AccessToken(settings.LIVEKIT_API_KEY, settings.LIVEKIT_API_SECRET)
            .with_identity(str(identity))
            .with_name(name)
            .with_grants(grants)
            .with_ttl(timedelta(seconds=expires_in_seconds))
            .to_jwt()
        )
        return token
    except Exception:
        # Fallback to standard HS256 JWT
        import jwt
        now = int(time.time())
        claims = {
            "iss": settings.LIVEKIT_API_KEY,
            "sub": str(identity),
            "name": name,
            "nbf": now - 5,
            "exp": now + expires_in_seconds,
            "video": {
                "room": room_name,
                "roomJoin": True,
                "canPublish": True,
                "canSubscribe": True,
                "canPublishData": True,
                "roomAdmin": is_host,
            }
        }
        return jwt.encode(claims, settings.LIVEKIT_API_SECRET, algorithm="HS256")
