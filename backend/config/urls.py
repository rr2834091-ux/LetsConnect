from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/v1/auth/', include('apps.accounts.urls')),
    path('api/v1/organizations/', include('apps.organizations.urls')),
    path('api/v1/memberships/', include('apps.memberships.urls')),
    path('api/v1/teams/', include('apps.teams.urls')),
    path('api/v1/channels/', include('apps.channels.urls')),
    path('api/v1/communities/', include('apps.communities.urls')),
    path('api/v1/permissions/', include('apps.permissions.urls')),
    path('api/v1/messaging/', include('apps.messaging.urls')),
    path('api/v1/presence/', include('apps.presence.urls')),
    path('api/v1/meetings/', include('apps.meetings.urls')),
    path('api/v1/files/', include('apps.files.urls')),
    path('api/v1/notifications/', include('apps.notifications.urls')),
    path('api/v1/audit/', include('apps.audit.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
