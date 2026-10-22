from django.urls import path
from .views import OrganizationPresenceListView, UpdatePresenceStatusView, HeartbeatView

urlpatterns = [
    path('', OrganizationPresenceListView.as_view(), name='presence-list'),
    path('status/', UpdatePresenceStatusView.as_view(), name='presence-update-status'),
    path('heartbeat/', HeartbeatView.as_view(), name='presence-heartbeat'),
]
