from django.urls import path
from .views import OrganizationListView, OrganizationDetailView, OrganizationPermissionsView

urlpatterns = [
    path('', OrganizationListView.as_view(), name='organization-list'),
    path('<uuid:id>/', OrganizationDetailView.as_view(), name='organization-detail'),
    path('<uuid:id>/permissions/', OrganizationPermissionsView.as_view(), name='organization-permissions'),
]
