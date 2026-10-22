from django.urls import path
from .views import FileUploadView, FileListView, FileDownloadView

urlpatterns = [
    path('upload/', FileUploadView.as_view(), name='file-upload'),
    path('', FileListView.as_view(), name='file-list'),
    path('<uuid:id>/download/', FileDownloadView.as_view(), name='file-download'),
]
