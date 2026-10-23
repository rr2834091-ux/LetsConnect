import os
import uuid
from django.conf import settings
from django.http import FileResponse, Http404
from django.shortcuts import redirect
from rest_framework import generics, permissions, status, exceptions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser
from .models import FileAttachment
from .serializers import FileAttachmentSerializer
from .storage import get_storage_driver
from apps.notifications.services import create_notification

class FileUploadView(generics.CreateAPIView):
    serializer_class = FileAttachmentSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def create(self, request, *args, **kwargs):
        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({"detail": "No file uploaded."}, status=status.HTTP_400_BAD_REQUEST)

        org_id = request.data.get('organization_id') or getattr(request, 'active_org_id', None)
        conversation_id = request.data.get('conversation_id')
        channel_id = request.data.get('channel_id')

        # Enforce strict organisation-level permission check
        if org_id:
            from apps.memberships.models import Employee, AdminProfile
            is_member = Employee.objects.filter(
                organization_id=org_id,
                email__iexact=request.user.email,
                status='active'
            ).exists() or AdminProfile.objects.filter(user=request.user, organization_id=org_id).exists()
            if not is_member:
                return Response(
                    {"detail": "You are not authorized to upload files for this organization."},
                    status=status.HTTP_403_FORBIDDEN
                )

        # Generate unique organisation-scoped storage path
        file_id = uuid.uuid4().hex
        ext = file_obj.name.split('.')[-1] if '.' in file_obj.name else 'bin'
        safe_name = f"{uuid.uuid4().hex[:8]}.{ext}"
        if org_id:
            dest_path = f"organisations/{org_id}/attachments/{file_id}/{safe_name}"
        else:
            dest_path = f"personal/{request.user.id}/attachments/{file_id}/{safe_name}"

        driver = get_storage_driver()
        content_type = file_obj.content_type or 'application/octet-stream'
        stored_path = driver.upload(file_obj, dest_path, content_type=content_type)

        attachment = FileAttachment.objects.create(
            organization_id=org_id,
            uploader=request.user,
            filename=file_obj.name,
            file_size=file_obj.size,
            mime_type=content_type,
            storage_path=stored_path,
            storage_provider="supabase" if getattr(settings, 'SUPABASE_URL', '') else "local",
            conversation_id=conversation_id,
            channel_id=channel_id
        )

        # Notify participants if attached to a conversation
        if conversation_id:
            from apps.messaging.models import Conversation
            conv = Conversation.objects.filter(id=conversation_id).first()
            if conv:
                uploader_name = f"{request.user.first_name} {request.user.last_name}".strip() or request.user.username
                for p in conv.participants.exclude(user=request.user).select_related('user'):
                    create_notification(
                        user=p.user,
                        notification_type="file",
                        title=f"{uploader_name} shared a file",
                        body=f"Uploaded {file_obj.name} in {conv.title}",
                        organization=conv.organization,
                        data={"file_id": str(attachment.id), "link": "/files"}
                    )

        serializer = self.get_serializer(attachment, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class FileListView(generics.ListAPIView):
    serializer_class = FileAttachmentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        org_id = self.request.query_params.get('organization_id') or getattr(self.request, 'active_org_id', None)
        channel_id = self.request.query_params.get('channel_id')
        conv_id = self.request.query_params.get('conversation_id')

        qs = FileAttachment.objects.all()
        if org_id:
            from apps.memberships.models import Employee, AdminProfile
            is_member = Employee.objects.filter(
                organization_id=org_id,
                email__iexact=user.email,
                status='active'
            ).exists() or AdminProfile.objects.filter(user=user, organization_id=org_id).exists()
            if not is_member:
                raise exceptions.PermissionDenied("You are not authorized to access files in this organization.")
            qs = qs.filter(organization_id=org_id)
        else:
            # Personal context files
            qs = qs.filter(organization__isnull=True, uploader=user)

        if channel_id:
            qs = qs.filter(channel_id=channel_id)
        if conv_id:
            qs = qs.filter(conversation_id=conv_id)

        return qs.order_by('-created_at')


class FileDownloadView(APIView):
    """
    Secure, permission-checked file download endpoint.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, id):
        try:
            file_record = FileAttachment.objects.get(id=id)
        except FileAttachment.DoesNotExist:
            raise Http404("File not found.")

        # Permission verification
        if file_record.organization_id:
            from apps.memberships.models import Employee, AdminProfile
            is_member = Employee.objects.filter(
                organization_id=file_record.organization_id,
                email__iexact=request.user.email,
                status='active'
            ).exists() or AdminProfile.objects.filter(user=request.user, organization_id=file_record.organization_id).exists()
            if not is_member:
                return Response({"detail": "Not authorized to download this file."}, status=status.HTTP_403_FORBIDDEN)

        # If it's stored on a remote URL (Supabase), redirect to it
        if file_record.storage_path.startswith("http"):
            return redirect(file_record.storage_path)

        # Supabase Storage signed URL download
        driver = get_storage_driver()
        if file_record.storage_provider == "supabase" or file_record.storage_path.startswith("organisations/"):
            signed_url = driver.get_signed_url(file_record.storage_path, expires_in=3600)
            if signed_url and signed_url.startswith("http"):
                return redirect(signed_url)

        # Local media storage
        clean_path = file_record.storage_path
        if clean_path.startswith('/media/'):
            clean_path = clean_path[len('/media/'):]
        elif clean_path.startswith('media/'):
            clean_path = clean_path[len('media/'):]

        full_path = os.path.join(settings.MEDIA_ROOT, clean_path)
        if not os.path.exists(full_path):
            alt_path = os.path.join(settings.MEDIA_ROOT, "uploads", clean_path)
            if os.path.exists(alt_path):
                full_path = alt_path
            else:
                return Response({"detail": "File content not found on server storage."}, status=status.HTTP_404_NOT_FOUND)

        response = FileResponse(open(full_path, 'rb'), content_type=file_record.mime_type)
        response['Content-Disposition'] = f'attachment; filename="{file_record.filename}"'
        return response
