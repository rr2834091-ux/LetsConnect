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
  is_active: boolean;
  role_in_org?: string;
}

export interface Team {
  id: string;
  organization: string;
  name: string;
  description: string;
  visibility: 'public' | 'private';
  member_count: number;
  channels_count: number;
  user_role?: 'owner' | 'member' | null;
}

export interface Channel {
  id: string;
  team: string;
  name: string;
  channel_type: 'standard' | 'private';
  conversation_id?: string;
}

export interface Message {
  id: string;
  conversation: string;
  sender_name: string;
  content: string;
  created_at: string;
}

export interface Meeting {
  id: string;
  title: string;
  room_name: string;
  scheduled_start?: string;
  passcode?: string;
}
