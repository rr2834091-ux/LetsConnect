from django.urls import path
from .views import ChannelListCreateView, ChannelDetailView

urlpatterns = [
    path('', ChannelListCreateView.as_view(), name='channel-list-create'),
    path('<uuid:id>/', ChannelDetailView.as_view(), name='channel-detail'),
]
