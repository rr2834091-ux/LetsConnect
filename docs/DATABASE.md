# Database Architecture and Integration Specification

## 1. Executive Summary

LetsConnect integrates with an existing production **Supabase PostgreSQL** database shared with the **Admin Centre**. The database hosts multiple dynamic tenants (organisations), their administrators, organizational policies, employees, teams, and channels.

LetsConnect adheres to the following core tenets:
1. **Zero Destructive Alterations**: Never alter or drop existing tables, columns, foreign keys, or sequences created by the Admin Centre (`tc_*` and Django `auth_*`).
2. **Explicit Domain Boundaries**: Admin Centre tables are mapped in Django as managed or unmanaged representations, respecting their source-of-truth ownership.
3. **Additive Namespacing**: All new tables created specifically for LetsConnect are prefixed with `lc_` (e.g., `lc_conversations`, `lc_messages`, `lc_presence`, `lc_meetings`, `lc_files`, `lc_notifications`).
4. **Dynamic Multi-Tenancy**: The platform dynamically operates across any number of organisations stored in `tc_organizations`. Adding an organisation through the Admin Centre makes it immediately discoverable and functional in LetsConnect without code modification or redeployment.

---

## 2. Shared Database Inventory & Live Schema Inspection

Inspection of the live database (`aws-0-ap-northeast-2.pooler.supabase.com`) reveals 40 public tables across two functional realms:

### 2.1 Existing Admin Centre & Django Standard Tables (Preserved)

| Table Name | Owner Application | Description | LetsConnect Interaction |
| :--- | :--- | :--- | :--- |
| `auth_user` | Django Auth | System identities, password hashes, email credentials | Primary user identity reference for authentication |
| `tc_organizations` | Admin Centre (`organizations`) | Master organisation directory (UUID, legal_name, display_name, domain) | Organisation boundary validation and context |
| `tc_workspaces` | Admin Centre (`organizations`) | Organization workspace vanity slugs | Workspace context resolution |
| `tc_organization_settings` | Admin Centre (`organizations`) | Org-wide security settings, upload limits, timezone | Config & constraint enforcement |
| `tc_employees` | Admin Centre (`employees`) | Employee directory (UUID, first/last name, email, role, department) | Work account identity mapping & team assignments |
| `tc_departments` | Admin Centre (`employees`) | Organisational departmental units | Employee filtering & directory lookups |
| `tc_business_roles` | Admin Centre (`employees`) | System & custom business roles (Admin, Manager, HR, Team Leader, Employee) | Granular permission checks |
| `tc_teams` | Admin Centre (`teams_channels`) | Teams within an organisation (visibility, settings) | Collaboration teams listing and scoping |
| `tc_channels` | Admin Centre (`teams_channels`) | Channels inside teams (`standard`, `private`) | Channel messaging channels and scoping |
| `tc_team_memberships` | Admin Centre (`teams_channels`) | Association of employee to team with role (`owner`, `member`) | Team access validation and owner privilege checks |
| `tc_channel_memberships` | Admin Centre (`teams_channels`) | Explicit membership for private channels | Private channel access validation |
| `tc_organization_policies` | Admin Centre (`policies`) | Tenant policy flags (`team_owner_can_add_users`, `team_owner_can_create_teams_channels`, `user_can_create_teams_channels`) | Dynamic permission engine rules |
| `tc_meeting_policies` | Admin Centre (`policies`) | Org meeting policies (passcode, recording, screen sharing) | Audio/video policy enforcement |
| `tc_messaging_policies` | Admin Centre (`policies`) | Org messaging policies (chat enabled, edit/delete messages, max size) | Chat policy enforcement |
| `tc_admin_profiles` | Admin Centre (`authentication`) | Maps Django `auth_user` to managed `tc_organizations` | Administrative access resolution |
| `tc_email_verification_otps`| Admin Centre (`authentication`) | Secure OTP verification tokens | Work account invitation & recovery validation |
| `tc_admin_audit_logs` | Admin Centre (`audit_logs`) | Immutable audit trail of admin actions | Reference for administrative activity |
| `tc_integration_outbox` | Admin Centre (`audit_logs`) | Transactional outbox for event tracking | Real-time synchronization events |

---

## 3. LetsConnect Additive Tables (`lc_*`)

LetsConnect introduces the following additive tables to store rich collaboration data while referencing existing Admin Centre foreign keys:

### 3.1 `lc_conversations`
Represents a collaboration thread: direct message (1:1), private group chat, channel message stream, or meeting chat.
- `id` (UUID, PK)
- `conversation_type` (Enum: `direct`, `group`, `channel`, `meeting`)
- `organization_id` (UUID, nullable, FK -> `tc_organizations.id`, null for personal accounts)
- `channel_id` (UUID, nullable, FK -> `tc_channels.id`)
- `meeting_id` (UUID, nullable)
- `title` (VARCHAR 255, blank for direct)
- `created_by_id` (INT, FK -> `auth_user.id`)
- `created_at`, `updated_at` (TIMESTAMPTZ)

### 3.2 `lc_conversation_participants`
Tracks participant membership and read receipts in conversations.
- `id` (UUID, PK)
- `conversation_id` (UUID, FK -> `lc_conversations.id`)
- `user_id` (INT, FK -> `auth_user.id`)
- `employee_id` (UUID, nullable, FK -> `tc_employees.id`)
- `role` (VARCHAR 20, `admin` or `member`)
- `joined_at` (TIMESTAMPTZ)
- `last_read_at` (TIMESTAMPTZ)

### 3.3 `lc_messages`
Stores persistent chat messages, parent references for threaded replies, reaction maps, and edit history.
- `id` (UUID, PK)
- `conversation_id` (UUID, FK -> `lc_conversations.id`)
- `sender_id` (INT, FK -> `auth_user.id`)
- `sender_name` (VARCHAR 150)
- `content` (TEXT)
- `parent_message_id` (UUID, nullable, FK -> `lc_messages.id` for threads)
- `is_edited` (BOOLEAN, default False)
- `is_deleted` (BOOLEAN, default False)
- `attachments` (JSONB, array of metadata: filename, url, size, mime_type)
- `reactions` (JSONB, mapping of emoji to user ID arrays)
- `created_at`, `updated_at` (TIMESTAMPTZ)

### 3.4 `lc_presence`
Maintains real-time user status, manual override flags, and activity timestamps.
- `user_id` (INT, PK, FK -> `auth_user.id`)
- `status` (VARCHAR 30: `available`, `busy`, `dnd`, `away`, `be_right_back`, `offline`)
- `custom_status_message` (VARCHAR 255, blank=True)
- `status_expires_at` (TIMESTAMPTZ, nullable)
- `is_manual` (BOOLEAN, default False)
- `last_active_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

### 3.5 `lc_meetings`
Tracks scheduled and instant LiveKit audio/video conferences.
- `id` (UUID, PK)
- `organization_id` (UUID, nullable, FK -> `tc_organizations.id`)
- `title` (VARCHAR 255)
- `description` (TEXT)
- `room_name` (VARCHAR 100, unique LiveKit room key)
- `host_id` (INT, FK -> `auth_user.id`)
- `scheduled_start` (TIMESTAMPTZ)
- `scheduled_end` (TIMESTAMPTZ)
- `passcode` (VARCHAR 50, blank=True)
- `is_instant` (BOOLEAN, default False)
- `is_ended` (BOOLEAN, default False)
- `allow_guest` (BOOLEAN, default True)
- `created_at`, `updated_at` (TIMESTAMPTZ)

### 3.6 `lc_files`
Metadata tracking for uploads stored in Supabase Storage or S3.
- `id` (UUID, PK)
- `organization_id` (UUID, nullable, FK -> `tc_organizations.id`)
- `uploader_id` (INT, FK -> `auth_user.id`)
- `filename` (VARCHAR 255)
- `file_size` (BIGINT)
- `mime_type` (VARCHAR 100)
- `storage_path` (VARCHAR 500)
- `storage_provider` (VARCHAR 50: `supabase`, `s3`, `local`)
- `conversation_id` (UUID, nullable, FK -> `lc_conversations.id`)
- `created_at` (TIMESTAMPTZ)

### 3.7 `lc_notifications`
In-app and push notifications for mentions, messages, invites, and reminders.
- `id` (UUID, PK)
- `user_id` (INT, FK -> `auth_user.id`)
- `organization_id` (UUID, nullable, FK -> `tc_organizations.id`)
- `notification_type` (VARCHAR 50: `message`, `mention`, `team_invite`, `meeting_invite`, `system`)
- `title` (VARCHAR 255)
- `body` (TEXT)
- `data` (JSONB)
- `is_read` (BOOLEAN, default False)
- `created_at` (TIMESTAMPTZ)

### 3.8 `lc_user_preferences`
Persisted client configuration per user.
- `user_id` (INT, PK, FK -> `auth_user.id`)
- `theme` (VARCHAR 20: `dark`, `light`, `system`)
- `active_context` (VARCHAR 20: `work`, `personal`)
- `active_organization_id` (UUID, nullable, FK -> `tc_organizations.id`)
- `notification_settings` (JSONB)
- `updated_at` (TIMESTAMPTZ)

---

## 4. Multi-Tenant Identity & Account Isolation

1. **Personal Accounts**:
   - Registered independently with email & password.
   - Operates in `active_context = 'personal'`, where `organization_id` is `NULL`.
   - Access is strictly isolated to direct messages, personal meetings, and personal storage.

2. **Work Accounts**:
   - Provisioned by Tenant Admin through Admin Centre (`tc_employees` record exists).
   - On first sign-in, user verifies email via OTP, associates/creates `auth_user`, and sets password.
   - Operates in `active_context = 'work'`, scoped to a verified `organization_id` and linked `tc_employees` record.
   - Permissions dynamically calculated from `tc_employees.role`, `tc_team_memberships`, and `tc_organization_policies`.

3. **Context Switching**:
   - Profile account switcher switches context between Personal and any Work organization memberships.
   - Every API request validates context and resource ownership: requests with foreign or mismatched `organization_id` are rejected with HTTP 403 Forbidden.
