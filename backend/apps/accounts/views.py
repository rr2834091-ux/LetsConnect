import secrets
import requests
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.core.mail import send_mail
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework import status, views, permissions
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from .models import EmailVerificationOTP, UserPreference
from .serializers import (
    LoginSerializer, RegisterPersonalSerializer, WorkSetupCheckSerializer,
    SendOTPSerializer, VerifyOTPSerializer, SetPasswordSerializer,
    UserSerializer, UserPreferenceSerializer
)
from apps.organizations.models import Organization
from apps.organizations.serializers import OrganizationSerializer
from apps.memberships.models import Employee, AdminProfile

def get_user_organizations(user):
    """
    Return all active organizations the user has access to.
    """
    emp_org_ids = Employee.objects.filter(
        email__iexact=user.email,
        status='active'
    ).values_list('organization_id', flat=True)

    admin_org_ids = AdminProfile.objects.filter(
        user=user
    ).values_list('organization_id', flat=True)

    all_org_ids = set(list(emp_org_ids) + list(admin_org_ids))
    return Organization.objects.filter(id__in=all_org_ids, is_active=True)


class LoginView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email'].lower().strip()
        password = serializer.validated_data['password']
        req_context = serializer.validated_data['context']

        user = User.objects.filter(email__iexact=email).first()
        if not user:
            user = User.objects.filter(username__iexact=email).first()

        if not user:
            # Check if this is a provisioned employee who hasn't set their password yet
            emp = Employee.objects.filter(email__iexact=email, status='active').first()
            if emp:
                return Response({
                    "detail": "Account provisioned by Admin Centre but first-time setup is required.",
                    "requires_first_time_setup": True,
                    "email": email
                }, status=status.HTTP_403_FORBIDDEN)
            return Response({"detail": "Invalid email or password."}, status=status.HTTP_401_UNAUTHORIZED)

        if not user.check_password(password):
            return Response({"detail": "Invalid email or password."}, status=status.HTTP_401_UNAUTHORIZED)

        if not user.is_active:
            return Response({"detail": "This account has been deactivated. Please contact your organization administrator for reactivation."}, status=status.HTTP_403_FORBIDDEN)

        # Work context check
        orgs = get_user_organizations(user)
        if req_context == 'work' and not orgs.exists():
            return Response({
                "detail": "No active organization membership found for this account. Please use personal context or contact your administrator.",
                "has_work_membership": False
            }, status=status.HTTP_403_FORBIDDEN)

        token, _ = Token.objects.get_or_create(user=user)
        pref, _ = UserPreference.objects.get_or_create(user=user)

        # Set default organization context
        active_org = pref.active_organization
        if req_context == 'work':
            pref.active_context = 'work'
            if not active_org or active_org not in orgs:
                active_org = orgs.first()
                pref.active_organization = active_org
            pref.save()
        else:
            pref.active_context = 'personal'
            pref.active_organization = None
            pref.save()

        # Update initial presence to available
        from apps.presence.models import Presence
        Presence.objects.update_or_create(
            user=user,
            defaults={
                'status': 'available',
                'last_active_at': timezone.now()
            }
        )

        orgs_data = OrganizationSerializer(orgs, many=True, context={'request': request}).data

        return Response({
            "token": token.key,
            "user": UserSerializer(user).data,
            "active_context": pref.active_context,
            "active_organization": OrganizationSerializer(active_org).data if active_org else None,
            "organizations": orgs_data,
            "preferences": UserPreferenceSerializer(pref).data
        })


class RegisterPersonalView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = RegisterPersonalSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email'].lower().strip()
        password = serializer.validated_data['password']
        first_name = serializer.validated_data['first_name']
        last_name = serializer.validated_data.get('last_name', '')

        if User.objects.filter(email__iexact=email).exists():
            return Response({"detail": "An account with this email already exists."}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            user = User.objects.create_user(
                username=email,
                email=email,
                password=password,
                first_name=first_name,
                last_name=last_name
            )
            UserPreference.objects.create(
                user=user,
                theme='dark',
                active_context='personal'
            )
            token, _ = Token.objects.get_or_create(user=user)

            return Response({
                "token": token.key,
                "user": UserSerializer(user).data,
                "active_context": "personal",
                "organizations": []
            }, status=status.HTTP_201_CREATED)


class WorkSetupCheckView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = WorkSetupCheckSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email'].lower().strip()

        emp = Employee.objects.filter(email__iexact=email, status='active').first()
        admin_prof = AdminProfile.objects.filter(user__email__iexact=email).first()

        if not emp and not admin_prof:
            return Response({
                "eligible": False,
                "detail": "This email is not provisioned as a work account in the Admin Centre. Please check your email or contact your administrator."
            }, status=status.HTTP_404_NOT_FOUND)

        org = emp.organization if emp else admin_prof.organization
        existing_user = User.objects.filter(email__iexact=email).first()
        has_usable_password = existing_user.has_usable_password() if existing_user else False

        return Response({
            "eligible": True,
            "organization_name": org.display_name if org else "Your Organization",
            "first_name": emp.first_name if emp else existing_user.first_name,
            "last_name": emp.last_name if emp else existing_user.last_name,
            "needs_password_setup": not has_usable_password
        })


class SendOTPView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = SendOTPSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email'].lower().strip()
        purpose = serializer.validated_data['purpose']

        code = f"{secrets.randbelow(900000) + 100000:06d}"
        otp_record = EmailVerificationOTP(email=email, purpose=purpose)
        otp_record.set_otp(code)
        otp_record.save()

        # Send email via Django configured backend
        try:
            send_mail(
                subject=f"LetsConnect Verification Code: {code}",
                message=f"Your LetsConnect verification code is: {code}\n\nThis code will expire in 10 minutes. If you did not request this, please ignore this email.",
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[email],
                fail_silently=False
            )
            email_sent = True
        except Exception:
            email_sent = False

        return Response({
            "detail": "Verification code generated and dispatched.",
            "email_sent": email_sent,
            "debug_code": code if settings.DEBUG else None
        })


class VerifyOTPView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = VerifyOTPSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email'].lower().strip()
        code = serializer.validated_data['code']
        purpose = serializer.validated_data['purpose']

        otp_record = EmailVerificationOTP.objects.filter(
            email=email,
            purpose=purpose,
            is_verified=False
        ).order_by('-created_at').first()

        if not otp_record:
            return Response({"detail": "No active verification code found for this email."}, status=status.HTTP_400_BAD_REQUEST)

        valid, msg = otp_record.verify_otp(code)
        if not valid:
            return Response({"detail": msg}, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            "detail": "Verification successful.",
            "reset_token": otp_record.reset_token
        })


class SetInitialPasswordView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = SetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email'].lower().strip()
        reset_token = serializer.validated_data['reset_token']
        password = serializer.validated_data['password']

        otp_record = EmailVerificationOTP.objects.filter(
            email=email,
            reset_token=reset_token,
            is_verified=True
        ).first()

        if not otp_record:
            return Response({"detail": "Invalid or expired reset token."}, status=status.HTTP_400_BAD_REQUEST)

        # Find employee or user
        emp = Employee.objects.filter(email__iexact=email).first()
        user, created = User.objects.get_or_create(
            username=email,
            defaults={
                'email': email,
                'first_name': emp.first_name if emp else "",
                'last_name': emp.last_name if emp else ""
            }
        )
        user.set_password(password)
        user.save()

        # Invalidate reset token
        otp_record.reset_token = ""
        otp_record.save()

        # Setup preferences
        pref, _ = UserPreference.objects.get_or_create(user=user)
        if emp:
            pref.active_organization = emp.organization
            pref.active_context = 'work'
            pref.save()

        token, _ = Token.objects.get_or_create(user=user)
        return Response({
            "detail": "Password successfully set. You may now sign in.",
            "token": token.key,
            "user": UserSerializer(user).data
        })


class GoogleConfigView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        client_id = getattr(settings, 'GOOGLE_CLIENT_ID', '') or ''
        return Response({
            "client_id": client_id,
            "configured": bool(client_id)
        })


class GoogleAuthView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        id_token = request.data.get('id_token')
        access_token = request.data.get('access_token')

        if not id_token and not access_token:
            return Response({"detail": "Google ID token or access token is required."}, status=status.HTTP_400_BAD_REQUEST)

        google_data = {}
        # Real verification of Google token with Google endpoints
        try:
            if access_token:
                resp = requests.get(
                    "https://www.googleapis.com/oauth2/v3/userinfo",
                    headers={"Authorization": f"Bearer {access_token}"},
                    timeout=5
                )
                if resp.status_code != 200:
                    return Response({"detail": "Invalid Google OAuth access token."}, status=status.HTTP_400_BAD_REQUEST)
                google_data = resp.json()
            else:
                resp = requests.get(
                    f"https://oauth2.googleapis.com/tokeninfo?id_token={id_token}",
                    timeout=5
                )
                if resp.status_code != 200:
                    return Response({"detail": "Invalid Google OAuth ID token."}, status=status.HTTP_400_BAD_REQUEST)
                google_data = resp.json()

                # Validate audience matches our GOOGLE_CLIENT_ID if configured
                client_id = getattr(settings, 'GOOGLE_CLIENT_ID', '')
                token_aud = google_data.get('aud')
                if client_id and token_aud != client_id:
                    return Response({"detail": "Google token audience mismatch."}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"detail": f"Failed to verify Google token: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)

        # Validate email is present and verified
        email = google_data.get('email')
        if not email:
            return Response({"detail": "Google token does not contain an email address."}, status=status.HTTP_400_BAD_REQUEST)
        email = email.lower().strip()

        email_verified = str(google_data.get('email_verified', '')).lower()
        if email_verified not in ('true', '1'):
            return Response({"detail": "Google account email is not verified."}, status=status.HTTP_400_BAD_REQUEST)

        first_name = google_data.get('given_name', '')
        last_name = google_data.get('family_name', '')
        picture = google_data.get('picture', '')

        # Context-aware account resolution
        req_context = request.data.get('context', 'personal')

        # Check work organization eligibility
        emp = Employee.objects.filter(email__iexact=email, status='active').first()
        admin_prof = AdminProfile.objects.filter(user__email__iexact=email).first()

        if req_context == 'work' and not emp and not admin_prof:
            return Response({
                "detail": "This Google account is not provisioned as an active work account in the Admin Centre. Please contact your administrator or sign in as a Personal Account.",
                "has_work_membership": False
            }, status=status.HTTP_403_FORBIDDEN)

        user = User.objects.filter(email__iexact=email).first()
        if not user:
            user = User.objects.create_user(
                username=email,
                email=email,
                first_name=first_name,
                last_name=last_name
            )
        elif first_name and not user.first_name:
            user.first_name = first_name
            user.last_name = last_name
            user.save(update_fields=['first_name', 'last_name'])

        pref, _ = UserPreference.objects.get_or_create(user=user)
        orgs = get_user_organizations(user)

        if req_context == 'work':
            pref.active_context = 'work'
            active_org = emp.organization if emp else (admin_prof.organization if admin_prof else orgs.first())
            pref.active_organization = active_org
            pref.save()
            returned_orgs = OrganizationSerializer(orgs, many=True, context={'request': request}).data
        else:
            # Personal context: completely isolated from company data
            pref.active_context = 'personal'
            pref.active_organization = None
            pref.save()
            active_org = None
            returned_orgs = []

            # Create or update isolated PersonalProfile
            from apps.communities.models import PersonalProfile
            PersonalProfile.objects.update_or_create(
                user=user,
                defaults={
                    'display_name': f"{first_name} {last_name}".strip() or email.split('@')[0],
                    'avatar_url': picture or '',
                }
            )

        # Update initial presence to available
        from apps.presence.models import Presence
        Presence.objects.update_or_create(
            user=user,
            defaults={
                'status': 'available',
                'last_active_at': timezone.now()
            }
        )

        token, _ = Token.objects.get_or_create(user=user)

        return Response({
            "token": token.key,
            "user": UserSerializer(user).data,
            "active_context": pref.active_context,
            "active_organization": OrganizationSerializer(active_org).data if active_org else None,
            "organizations": returned_orgs,
            "preferences": UserPreferenceSerializer(pref).data
        })


class ProfileView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        pref, _ = UserPreference.objects.get_or_create(user=user)
        orgs = get_user_organizations(user)

        from apps.presence.models import Presence
        from apps.communities.models import PersonalProfile
        from apps.communities.serializers import PersonalProfileSerializer
        presence = Presence.objects.filter(user=user).first()
        personal_profile, _ = PersonalProfile.objects.get_or_create(
            user=user,
            defaults={'display_name': f"{user.first_name} {user.last_name}".strip() or user.username}
        )

        return Response({
            "user": UserSerializer(user).data,
            "personal_profile": PersonalProfileSerializer(personal_profile).data,
            "preferences": UserPreferenceSerializer(pref).data,
            "active_context": pref.active_context,
            "active_organization": OrganizationSerializer(pref.active_organization).data if pref.active_organization else None,
            "organizations": OrganizationSerializer(orgs, many=True, context={'request': request}).data,
            "presence": {
                "status": presence.status if presence else "available",
                "custom_status": presence.custom_status_message if presence else ""
            }
        })

    def patch(self, request):
        user = request.user
        first_name = request.data.get('first_name')
        last_name = request.data.get('last_name')
        display_name = request.data.get('display_name')
        bio = request.data.get('bio')

        user_updated = False
        if first_name is not None:
            user.first_name = first_name.strip()
            user_updated = True
        if last_name is not None:
            user.last_name = last_name.strip()
            user_updated = True
        if user_updated:
            user.save()

        from apps.communities.models import PersonalProfile
        personal_profile, _ = PersonalProfile.objects.get_or_create(user=user)
        if display_name is not None:
            personal_profile.display_name = display_name.strip()
        if bio is not None:
            personal_profile.bio = bio.strip()
        personal_profile.save()

        return self.get(request)

    def put(self, request):
        return self.patch(request)


class SwitchContextView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        target_context = request.data.get('context')
        org_id = request.data.get('organization_id')

        if target_context not in ['personal', 'work']:
            return Response({"detail": "Context must be either 'personal' or 'work'."}, status=status.HTTP_400_BAD_REQUEST)

        pref, _ = UserPreference.objects.get_or_create(user=request.user)

        if target_context == 'personal':
            pref.active_context = 'personal'
            pref.active_organization = None
            pref.save()
            return Response({
                "active_context": "personal",
                "active_organization": None
            })

        # Validate organization
        orgs = get_user_organizations(request.user)
        target_org = None

        if org_id:
            target_org = orgs.filter(id=org_id).first()
            if not target_org:
                return Response({"detail": "You do not have access to the requested organization."}, status=status.HTTP_403_FORBIDDEN)
        else:
            if not orgs.exists():
                return Response({
                    "detail": "This account is not associated with any company organization. You can collaborate freely in your Personal Workspace."
                }, status=status.HTTP_400_BAD_REQUEST)
            target_org = orgs.first()

        pref.active_context = 'work'
        pref.active_organization = target_org
        pref.save()

        return Response({
            "active_context": "work",
            "active_organization": OrganizationSerializer(target_org).data
        })


class AccountDeactivationView(views.APIView):
    """
    Sign off and deactivate account.
    Verifies user password, invalidates active sessions and tokens,
    marks account inactive, and preserves conversation history.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        password = request.data.get('password')
        if not password:
            return Response(
                {"detail": "Current password is required to deactivate your account."},
                status=status.HTTP_400_BAD_REQUEST
            )

        user = request.user
        if not user.check_password(password):
            return Response(
                {"detail": "Incorrect password. Account could not be deactivated."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Deactivate user
        user.is_active = False
        user.save(update_fields=['is_active'])

        # Update employee status to deactivated if employee record exists
        Employee.objects.filter(email__iexact=user.email).update(status='deactivated')

        # Update presence status to offline
        from apps.presence.models import Presence
        Presence.objects.filter(user=user).update(status='offline', is_manual=True)

        # Invalidate authentication tokens
        Token.objects.filter(user=user).delete()

        return Response({
            "detail": "Thank you for being part of Let's Connect. We wish you a great career ahead."
        }, status=status.HTTP_200_OK)
