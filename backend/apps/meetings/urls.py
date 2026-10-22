from django.urls import path
from .views import (
    MeetingListCreateView, MeetingDetailView,
    JoinMeetingView, EndMeetingView
)

urlpatterns = [
    path('', MeetingListCreateView.as_view(), name='meeting-list-create'),
    path('join/', JoinMeetingView.as_view(), name='meeting-join'),
    path('<uuid:id>/', MeetingDetailView.as_view(), name='meeting-detail'),
    path('<uuid:id>/end/', EndMeetingView.as_view(), name='meeting-end'),
]
