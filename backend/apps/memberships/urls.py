from django.urls import path
from .views import EmployeeDirectoryListView, EmployeeDetailView
from .profile_view import MemberProfileDetailView

urlpatterns = [
    path('directory/', EmployeeDirectoryListView.as_view(), name='employee-directory'),
    path('directory/<uuid:id>/', EmployeeDetailView.as_view(), name='employee-detail'),
    path('profile/<str:identifier>/', MemberProfileDetailView.as_view(), name='member-profile-detail'),
    path('profile/', MemberProfileDetailView.as_view(), name='member-profile'),
]
