from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, status
from django.db.models import Q
from apps.memberships.models import Employee, AdminProfile
from apps.messaging.models import Message, Conversation, ConversationParticipant
from apps.channels.models import Channel
from apps.teams.models import Team, TeamMembership
from apps.meetings.models import Meeting
from apps.presence.models import Presence
from django.contrib.auth.models import User

class UnifiedSearchView(APIView):
    """
    Unified global search endpoint across:
    - People (Colleagues in organization)
    - Messages (Accessible direct, group, and channel messages)
    - Channels (Accessible public or joined team channels)
    - Meetings (Scheduled and upcoming meetings)
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        query = request.query_params.get('q', '').strip()
        org_id = request.query_params.get('organization_id') or getattr(request, 'active_org_id', None)
        user = request.user

        if not query:
            return Response({
                "query": "",
                "results": {
                    "people": [],
                    "messages": [],
                    "channels": [],
                    "meetings": []
                }
            })

        results = {
            "people": [],
            "messages": [],
            "channels": [],
            "meetings": []
        }

        # 1. Search People (Employees in active organization or direct users)
        if org_id:
            emp_qs = Employee.objects.filter(
                organization_id=org_id,
                status='active'
            ).filter(
                Q(first_name__icontains=query) |
                Q(last_name__icontains=query) |
                Q(email__icontains=query) |
                Q(job_title__icontains=query)
            ).select_related('department', 'role')[:8]

            emp_emails = [e.email for e in emp_qs]
            user_map = {u.email.lower(): u.id for u in User.objects.filter(email__in=emp_emails)}
            presence_map = {str(p.user_id): p.status for p in Presence.objects.filter(user_id__in=user_map.values())}

            for emp in emp_qs:
                uid = user_map.get(emp.email.lower())
                p_status = presence_map.get(str(uid), "available") if uid else "available"
                results["people"].append({
                    "id": str(emp.id),
                    "user_id": uid,
                    "full_name": f"{emp.first_name} {emp.last_name}".strip(),
                    "email": emp.email,
                    "job_title": emp.job_title or "Team Member",
                    "department": emp.department.name if emp.department else "General",
                    "presence_status": p_status
                })
        else:
            # Personal context: search known users from direct conversations
            my_conv_user_ids = ConversationParticipant.objects.filter(
                conversation__organization__isnull=True,
                conversation__participants__user=user
            ).exclude(user=user).values_list('user_id', flat=True)

            users = User.objects.filter(id__in=my_conv_user_ids).filter(
                Q(first_name__icontains=query) | Q(last_name__icontains=query) | Q(username__icontains=query)
            )[:8]
            for u in users:
                results["people"].append({
                    "id": str(u.id),
                    "user_id": u.id,
                    "full_name": f"{u.first_name} {u.last_name}".strip() or u.username,
                    "email": u.email,
                    "job_title": "Personal Contact",
                    "department": "Personal",
                    "presence_status": "available"
                })

        # 2. Search Messages
        # Only search messages in conversations accessible to user
        my_conv_ids = ConversationParticipant.objects.filter(
            user=user,
            is_hidden=False
        ).values_list('conversation_id', flat=True)

        accessible_conv_ids = set(my_conv_ids)

        if org_id:
            emp = Employee.objects.filter(organization_id=org_id, email__iexact=user.email).first()
            my_team_ids = list(TeamMembership.objects.filter(employee=emp).values_list('team_id', flat=True)) if emp else []
            channel_conv_ids = Conversation.objects.filter(
                organization_id=org_id,
                conversation_type='channel'
            ).filter(
                Q(channel__team_id__in=my_team_ids) | Q(channel__team__visibility='public')
            ).values_list('id', flat=True)
            accessible_conv_ids.update(channel_conv_ids)

        msg_qs = Message.objects.filter(
            conversation_id__in=accessible_conv_ids,
            is_deleted=False,
            content__icontains=query
        ).select_related('conversation', 'sender').order_by('-created_at')[:8]

        for m in msg_qs:
            snippet = m.content[:120] + ("..." if len(m.content) > 120 else "")
            results["messages"].append({
                "id": str(m.id),
                "conversation_id": str(m.conversation_id),
                "conversation_title": m.conversation.title or "Conversation",
                "conversation_type": m.conversation.conversation_type,
                "sender_name": m.sender_name,
                "content_snippet": snippet,
                "created_at": m.created_at.isoformat()
            })

        # 3. Search Channels & Teams
        if org_id:
            emp = Employee.objects.filter(organization_id=org_id, email__iexact=user.email).first()
            my_team_ids = list(TeamMembership.objects.filter(employee=emp).values_list('team_id', flat=True)) if emp else []
            channels = Channel.objects.filter(
                team__organization_id=org_id,
                is_archived=False,
                name__icontains=query
            ).filter(
                Q(team_id__in=my_team_ids) | Q(team__visibility='public')
            ).select_related('team')[:6]

            for ch in channels:
                conv = Conversation.objects.filter(channel=ch).first()
                results["channels"].append({
                    "id": str(ch.id),
                    "name": ch.name,
                    "team_id": str(ch.team_id),
                    "team_name": ch.team.name,
                    "conversation_id": str(conv.id) if conv else None
                })

        # 4. Search Meetings
        meeting_filter = Q(title__icontains=query) & Q(is_ended=False)
        if org_id:
            meeting_filter &= (Q(organization_id=org_id) | Q(host=user))
        else:
            meeting_filter &= (Q(host=user) | Q(participants__user=user))

        meetings = Meeting.objects.filter(meeting_filter).distinct().order_by('scheduled_start')[:6]
        for mt in meetings:
            results["meetings"].append({
                "id": str(mt.id),
                "title": mt.title,
                "room_name": mt.room_name,
                "scheduled_start": mt.scheduled_start.isoformat() if mt.scheduled_start else None,
                "is_instant": mt.is_instant
            })

        return Response({
            "query": query,
            "results": results
        })
