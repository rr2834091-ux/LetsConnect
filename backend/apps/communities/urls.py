from django.urls import path
from .views import (
    PersonalProfileView,
    PersonalCommunityListCreateView,
    PersonalCommunityDetailView,
    PersonalCommunityJoinView,
    PersonalCommunityChannelListCreateView
)

urlpatterns = [
    path('profile/', PersonalProfileView.as_view(), name='personal-profile'),
    path('', PersonalCommunityListCreateView.as_view(), name='community-list-create'),
    path('<uuid:id>/', PersonalCommunityDetailView.as_view(), name='community-detail'),
    path('join/', PersonalCommunityJoinView.as_view(), name='community-join'),
    path('channels/', PersonalCommunityChannelListCreateView.as_view(), name='community-channel-list-create'),
]
