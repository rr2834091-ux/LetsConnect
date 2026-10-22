from django.urls import path
from .views import UserPermissionsView

urlpatterns = [
    path('check/', UserPermissionsView.as_view(), name='permission-check'),
]
