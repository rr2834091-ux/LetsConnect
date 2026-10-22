from django.urls import re_path
from .consumers import LetsConnectConsumer

websocket_urlpatterns = [
    re_path(r'^ws/connect/?$', LetsConnectConsumer.as_asgi()),
]
