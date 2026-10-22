from django.urls import path
from .views import TeamListCreateView, TeamDetailView, TeamMembersView

urlpatterns = [
    path('', TeamListCreateView.as_view(), name='team-list-create'),
    path('<uuid:id>/', TeamDetailView.as_view(), name='team-detail'),
    path('<uuid:id>/members/', TeamMembersView.as_view(), name='team-members'),
]
