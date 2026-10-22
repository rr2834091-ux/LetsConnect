export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
}

export interface Organization {
  id: string;
  legal_name: string;
  display_name: string;
  company_domain: string;
  organization_type: string;
  industry: string;
  company_size: string;
  is_active: boolean;
  role_in_org?: string;
}

export interface OrgPermissions {
  is_org_admin: boolean;
  is_team_owner: boolean;
  can_create_teams: boolean;
  team_owner_can_add_users: boolean;
  team_owner_can_create_teams_channels: boolean;
  user_can_create_teams_channels: boolean;
}

export interface Team {
  id: string;
  organization: string;
  name: string;
  description: string;
  visibility: 'public' | 'private';
  is_archived: boolean;
  allow_member_create_channels: boolean;
  member_count: number;
  channels_count: number;
  user_role?: 'owner' | 'member' | null;
  created_at: string;
}

export interface Channel {
  id: string;
  team: string;
  name: string;
  description: string;
  channel_type: 'standard' | 'private';
  is_archived: boolean;
  conversation_id?: string;
  created_at: string;
}

export interface ConversationParticipant {
  id: string;
  user: User;
  role: string;
  joined_at: string;
  last_read_at?: string;
}

export interface Conversation {
  id: string;
  conversation_type: 'direct' | 'group' | 'channel' | 'meeting';
  organization?: string;
  channel?: string;
  meeting_id?: string;
  title: string;
  created_by: number;
  participants: ConversationParticipant[];
  last_message?: {
    id: string;
    sender_name: string;
    content: string;
    created_at: string;
  };
  unread_count: number;
  updated_at: string;
  created_at: string;
}

export interface Message {
  id: string;
  conversation: string;
  sender: User;
  sender_name: string;
  content: string;
  parent_message?: string;
  is_edited: boolean;
  is_deleted: boolean;
  attachments: Array<{
    name: string;
    url: string;
    size?: number;
    type?: string;
  }>;
  reactions: Record<string, number[]>;
  replies_count?: number;
  created_at: string;
}

export interface Presence {
  user: User;
  status: 'available' | 'busy' | 'dnd' | 'away' | 'be_right_back' | 'offline';
  custom_status_message: string;
  status_expires_at?: string;
  is_manual: boolean;
  last_active_at: string;
  updated_at: string;
}

export interface Meeting {
  id: string;
  organization?: string;
  title: string;
  description: string;
  room_name: string;
  host: User;
  scheduled_start?: string;
  scheduled_end?: string;
  passcode?: string;
  is_instant: boolean;
  is_ended: boolean;
  allow_guest: boolean;
  created_at: string;
}

export interface Notification {
  id: string;
  notification_type: 'message' | 'mention' | 'team_invite' | 'meeting_invite' | 'system';
  title: string;
  body: string;
  data: Record<string, any>;
  is_read: boolean;
  created_at: string;
}

export interface FileAttachment {
  id: string;
  organization?: string;
  uploader: User;
  filename: string;
  file_size: number;
  mime_type: string;
  storage_path: string;
  download_url: string;
  conversation_id?: string;
  channel_id?: string;
  created_at: string;
}
