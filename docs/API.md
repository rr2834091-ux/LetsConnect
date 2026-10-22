# LetsConnect — REST API & WebSocket Specification

## 1. Overview & Authentication Conventions

All REST endpoints are rooted at `/api/v1/`.

### Headers
| Header | Description |
| :--- | :--- |
| `Authorization` | `Token <auth_token>` (obtained via login or registration) |
| `X-Organization-Id` | (Optional/Recommended) Active organization UUID context for work accounts |
| `Content-Type` | `application/json` |

---

## 2. Authentication & Identity Endpoints (`/api/v1/auth/`)

### `POST /api/v1/auth/login/`
Authenticates a user via email and password.
- **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "SecretPassword123!",
    "context": "work" // or "personal"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "token": "9944b09199c62bcf9418ad846dd0e4bbdfc6ee4b",
    "user": {
      "id": 1,
      "email": "user@example.com",
      "first_name": "Yuwa",
      "last_name": "Shree"
    },
    "active_context": "work",
    "organizations": [
      {
        "id": "4340e874-677b-4771-94c8-94e76736838a",
        "name": "tp",
        "role": "Owner"
      }
    ]
  }
  ```

### `POST /api/v1/auth/register-personal/`
Registers a new personal account.
- **Request Body**:
  ```json
  {
    "email": "personal@gmail.com",
    "password": "Password123!",
    "first_name": "Personal",
    "last_name": "User"
  }
  ```

### `POST /api/v1/auth/work-setup-check/`
Checks work account eligibility from Admin Centre provisioned directory (`tc_employees`).
- **Request Body**:
  ```json
  {
    "email": "employee@tptech.com"
  }
  ```
- **Response**: Returns whether employee is provisioned and needs OTP verification or password creation.

### `POST /api/v1/auth/send-otp/` & `POST /api/v1/auth/verify-otp/`
Generates and validates time-limited cryptographically secure OTPs for account activation or password reset.

### `POST /api/v1/auth/forgot-password/` & `POST /api/v1/auth/reset-password/`
Secure recovery flow.

### `POST /api/v1/auth/google/`
Verifies Google OAuth ID token on the backend and establishes a personal session.

---

## 3. Organizations & Workspaces (`/api/v1/organizations/`)

### `GET /api/v1/organizations/`
Lists all organizations to which the authenticated user belongs (via `tc_employees` or `tc_admin_profiles`).

### `GET /api/v1/organizations/<id>/`
Returns organization details and workspace metadata.

### `GET /api/v1/organizations/<id>/permissions/`
Returns the user's evaluated permissions for this organization:
- `can_create_teams`: Boolean
- `can_add_users`: Boolean
- `is_org_admin`: Boolean

---

## 4. Teams & Channels (`/api/v1/teams/` & `/api/v1/channels/`)

### `GET /api/v1/teams/?organization_id=<uuid>`
Lists all visible teams for the user in the specified organization.

### `POST /api/v1/teams/`
Creates a new team. Enforces `tc_organization_policies.team_owner_can_create_teams_channels` or `user_can_create_teams_channels`.

### `GET /api/v1/teams/<team_id>/channels/`
Lists standard and permitted private channels in the team.

### `POST /api/v1/teams/<team_id>/channels/`
Creates a new channel in the team.

### `POST /api/v1/teams/<team_id>/members/`
Adds a member to the team. Enforces `tc_organization_policies.team_owner_can_add_users`.

---

## 5. Conversations & Messaging (`/api/v1/messaging/`)

### `GET /api/v1/messaging/conversations/`
Lists all active 1:1, group, and channel conversations for the current context.

### `GET /api/v1/messaging/conversations/<id>/messages/?page=1&limit=50`
Paginated message history with threads and reactions.

### `POST /api/v1/messaging/conversations/<id>/messages/`
Sends a message to the conversation.
- **Request Body**:
  ```json
  {
    "content": "Hello team!",
    "parent_message_id": null,
    "attachments": []
  }
  ```

### `POST /api/v1/messaging/messages/<id>/reactions/`
Adds or toggles an emoji reaction on a message.

---

## 6. Real-Time Presence (`/api/v1/presence/`)

### `GET /api/v1/presence/`
Returns presence for users in the current organization.

### `POST /api/v1/presence/status/`
Updates the current user's presence state (`available`, `busy`, `dnd`, `away`, `be_right_back`, `offline`) and custom status message.

---

## 7. Meetings & LiveKit Calling (`/api/v1/meetings/`)

### `POST /api/v1/meetings/`
Schedules a new meeting or creates an instant meeting room.

### `POST /api/v1/meetings/join/`
Generates a LiveKit access token after validating meeting access rules, passcode, and guest permissions.
- **Request Body**:
  ```json
  {
    "meeting_id": "<uuid-or-room-name>",
    "passcode": "123456",
    "guest_name": "Guest User" // if unauthenticated
  }
  ```
- **Response**:
  ```json
  {
    "token": "eyJhbGciOi...",
    "livekit_url": "wss://letsconnect-dev.livekit.cloud",
    "room_name": "room-uuid",
    "role": "attendee"
  }
  ```

---

## 8. Files & Storage (`/api/v1/files/`)

### `POST /api/v1/files/upload/`
Uploads an attachment to Supabase Storage and records metadata in `lc_files`.

### `GET /api/v1/files/<id>/download/`
Generates a signed, time-limited download URL after validating organization membership.

---

## 9. WebSocket Gateway

- **URL**: `ws://<host>:8000/ws/connect/?token=<auth_token>`
- **Channels Supported**:
  - `chat_message`: Broadcasts new messages in real time.
  - `typing_indicator`: Shows "[User] is typing...".
  - `presence_update`: Broadcasts real-time presence changes.
  - `reaction_update`: Broadcasts emoji reactions.
