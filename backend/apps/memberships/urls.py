from django.urls import path
from .views import EmployeeDirectoryListView, EmployeeDetailView

urlpatterns = [
    path('directory/', EmployeeDirectoryListView.as_view(), name='employee-directory'),
    path('directory/<uuid:id>/', EmployeeDetailView.as_view(), name='employee-detail'),
]
