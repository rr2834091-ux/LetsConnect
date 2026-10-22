import uuid
from rest_framework import generics, permissions, status, exceptions
from rest_framework.response import Response
from rest_framework.views import APIView
from django.conf import settings
from django.db.models import Q
from django.utils import timezone
from .models import Meeting, MeetingParticipant
from .serializers import MeetingSerializer, JoinMeetingSerializer
from .livekit_service import generate_livekit_token
from apps.organizations.models import Organization
from apps.permissions.evaluator import is_org_admin

class MeetingListCreateView(generics.ListCreateAPIView):
    serializer_class = MeetingSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        org_id = self.request.query_params.get('organization_id') or getattr(self.request, 'active_org_id', None)

        qs = Meeting.objects.filter(is_ended=False)
        if org_id:
            from apps.memberships.models import Employee, AdminProfile
            is_member = Employee.objects.filter(
                organization_id=org_id,
                email__iexact=user.email,
                status='active'
            ).exists() or AdminProfile.objects.filter(user=user, organization_id=org_id).exists()
            if not is_member:
                raise exceptions.PermissionDenied("You are not authorized to access meetings in this organization.")
            qs = qs.filter(organization_id=org_id)
        else:
            qs = qs.filter(Q(organization__isnull=True) | Q(host=user) | Q(participants__user=user))

        return qs.distinct().order_by('scheduled_start', '-created_at')

    def create(self, request, *args, **kwargs):
        title = request.data.get('title', 'Quick Meeting')
        description = request.data.get('description', '')
        scheduled_start = request.data.get('scheduled_start')
        scheduled_end = request.data.get('scheduled_end')
        passcode = request.data.get('passcode', '')
        is_instant = request.data.get('is_instant', True)
        allow_guest = request.data.get('allow_guest', True)
        org_id = request.data.get('organization') or getattr(request, 'active_org_id', None)

        # Validate past-date scheduling
        parsed_start = None
        if scheduled_start and not is_instant:
            from dateutil import parser
            from datetime import timedelta
            try:
                parsed_start = parser.parse(scheduled_start) if isinstance(scheduled_start, str) else scheduled_start
                if timezone.is_naive(parsed_start):
                    parsed_start = timezone.make_aware(parsed_start)
                if parsed_start < timezone.now() - timedelta(minutes=5):
                    return Response(
                        {"detail": "Cannot schedule a meeting in the past. Please select a future date and time."},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            except Exception as e:
                if not isinstance(e, ValueError):
                    pass

        if scheduled_end and parsed_start:
            from dateutil import parser
            try:
                parsed_end = parser.parse(scheduled_end) if isinstance(scheduled_end, str) else scheduled_end
                if timezone.is_naive(parsed_end):
                    parsed_end = timezone.make_aware(parsed_end)
                if parsed_end <= parsed_start:
                    return Response(
                        {"detail": "Meeting end time must be after start time."},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            except Exception:
                pass

        room_name = f"room_{uuid.uuid4().hex[:12]}"

        meeting = Meeting.objects.create(
            organization_id=org_id,
            title=title,
            description=description,
            room_name=room_name,
            host=request.user,
            scheduled_start=scheduled_start or timezone.now(),
            scheduled_end=scheduled_end,
            passcode=passcode,
            is_instant=is_instant,
            allow_guest=allow_guest
        )

        # Notify and add invitees if provided
        invitees = request.data.get('attendees') or request.data.get('invitee_ids') or []
        if isinstance(invitees, list) and invitees:
            from apps.notifications.services import create_notification
            for inv in invitees:
                inv_id = inv.get('id') if isinstance(inv, dict) else inv
                try:
                    target_user = User.objects.get(id=inv_id)
                    if target_user != request.user:
                        MeetingParticipant.objects.get_or_create(
                            meeting=meeting,
                            user=target_user,
                            defaults={'role': 'attendee'}
                        )
                        create_notification(
                            user=target_user,
                            notification_type='meeting_invite',
                            title=f"Meeting Invite: {meeting.title}",
                            body=f"{request.user.first_name or request.user.username} invited you to '{meeting.title}'",
                            organization=meeting.organization,
                            data={"meeting_id": str(meeting.id), "room_name": meeting.room_name, "link": f"/meetings/{meeting.id}"}
                        )
                except Exception:
                    pass

        serializer = self.get_serializer(meeting)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class MeetingDetailView(generics.RetrieveAPIView):
    serializer_class = MeetingSerializer
    permission_classes = [permissions.AllowAny]
    lookup_field = 'id'

    def get_queryset(self):
        return Meeting.objects.all()


class JoinMeetingView(APIView):
    """
    Validates meeting access, passcode, and guest permissions,
    then generates a cryptographically signed LiveKit token.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = JoinMeetingSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        meeting_id_or_room = serializer.validated_data['meeting_id'].strip()
        passcode = serializer.validated_data.get('passcode', '').strip()
        guest_name = serializer.validated_data.get('guest_name', '').strip()

        # Find meeting by ID or room_name
        meeting = None
        try:
            val_uuid = uuid.UUID(meeting_id_or_room)
            meeting = Meeting.objects.filter(id=val_uuid).first()
        except ValueError:
            pass

        if not meeting:
            meeting = Meeting.objects.filter(room_name=meeting_id_or_room).first()

        if not meeting:
            return Response({"detail": "Meeting not found. Please verify the meeting ID or link."}, status=status.HTTP_404_NOT_FOUND)

        if meeting.is_ended:
            return Response({"detail": "This meeting has ended."}, status=status.HTTP_400_BAD_REQUEST)

        # Passcode check
        if meeting.passcode and meeting.passcode != passcode:
            return Response({"detail": "Invalid meeting passcode."}, status=status.HTTP_403_FORBIDDEN)

        # Determine user identity and role
        user = request.user if request.user and request.user.is_authenticated else None

        if not user:
            # Guest check
            if not meeting.allow_guest:
                return Response({"detail": "Guest access is disabled for this meeting. Please sign in."}, status=status.HTTP_403_FORBIDDEN)
            if not guest_name:
                return Response({"detail": "Please provide your display name to join as a guest."}, status=status.HTTP_400_BAD_REQUEST)

            identity = f"guest_{uuid.uuid4().hex[:8]}"
            display_name = f"{guest_name} (Guest)"
            role = "attendee"
            is_host = False

            MeetingParticipant.objects.create(
                meeting=meeting,
                user=None,
                guest_name=guest_name,
                role='attendee'
            )
        else:
            identity = str(user.id)
            display_name = f"{user.first_name} {user.last_name}".strip() or user.username
            is_host = (meeting.host_id == user.id) or is_org_admin(user, meeting.organization_id)
            role = "host" if is_host else "attendee"

            MeetingParticipant.objects.create(
                meeting=meeting,
                user=user,
                role=role
            )

        # Generate LiveKit Token
        livekit_token = generate_livekit_token(
            room_name=meeting.room_name,
            identity=identity,
            name=display_name,
            is_host=is_host
        )

        return Response({
            "token": livekit_token,
            "livekit_url": settings.LIVEKIT_API_URL,
            "room_name": meeting.room_name,
            "title": meeting.title,
            "role": role,
            "display_name": display_name,
            "meeting_id": str(meeting.id),
            "is_host": is_host
        })


class EndMeetingView(APIView):
    """
    Host control to terminate a meeting.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, id):
        try:
            meeting = Meeting.objects.get(id=id)
        except Meeting.DoesNotExist:
            return Response({"detail": "Meeting not found."}, status=status.HTTP_404_NOT_FOUND)

        if meeting.host_id != request.user.id and not is_org_admin(request.user, meeting.organization_id):
            return Response({"detail": "Only the host or an organization admin can end this meeting."}, status=status.HTTP_403_FORBIDDEN)

        meeting.is_ended = True
        meeting.save()
        return Response({"detail": "Meeting ended successfully."})
