from django.urls import path
from .views import (
    ConversationListCreateView, ConversationDetailView,
    MessageListCreateView, MessageReactionView, ConversationMediaView,
    RemoveConversationView
)

urlpatterns = [
    path('conversations/', ConversationListCreateView.as_view(), name='conversation-list-create'),
    path('conversations/<uuid:id>/', ConversationDetailView.as_view(), name='conversation-detail'),
    path('conversations/<uuid:id>/remove-for-user/', RemoveConversationView.as_view(), name='conversation-remove-for-user'),
    path('conversations/<uuid:conversation_id>/messages/', MessageListCreateView.as_view(), name='message-list-create'),
    path('conversations/<uuid:conversation_id>/media/', ConversationMediaView.as_view(), name='conversation-media'),
    path('messages/<uuid:id>/reactions/', MessageReactionView.as_view(), name='message-reaction'),
]
