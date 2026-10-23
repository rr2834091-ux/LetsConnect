from django.urls import path
from .views import (
    LoginView, RegisterPersonalView, WorkSetupCheckView,
    SendOTPView, VerifyOTPView, SetInitialPasswordView,
    GoogleAuthView, GoogleConfigView, ProfileView, SwitchContextView,
    AccountDeactivationView
)

urlpatterns = [
    path('login/', LoginView.as_view(), name='auth-login'),
    path('register-personal/', RegisterPersonalView.as_view(), name='auth-register-personal'),
    path('work-setup-check/', WorkSetupCheckView.as_view(), name='auth-work-setup-check'),
    path('send-otp/', SendOTPView.as_view(), name='auth-send-otp'),
    path('verify-otp/', VerifyOTPView.as_view(), name='auth-verify-otp'),
    path('set-initial-password/', SetInitialPasswordView.as_view(), name='auth-set-initial-password'),
    path('google/', GoogleAuthView.as_view(), name='auth-google'),
    path('google/config/', GoogleConfigView.as_view(), name='auth-google-config'),
    path('profile/', ProfileView.as_view(), name='auth-profile'),
    path('switch-context/', SwitchContextView.as_view(), name='auth-switch-context'),
    path('deactivate/', AccountDeactivationView.as_view(), name='auth-deactivate'),
]
