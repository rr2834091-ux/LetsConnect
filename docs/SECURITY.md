# LetsConnect — Security, Authorization & Isolation Specification

## 1. Multi-Tenant Data Isolation Principles

Multi-tenant data isolation is the cornerstone of LetsConnect security:
- **No Cross-Tenant Query Leaks**: Every database query scoped to an organization enforces `organization_id = request.user_active_organization_id`.
- **Server-Side Authorization**: The backend never trusts client assertions or hidden UI elements. Permissions are verified dynamically on the backend before executing any database mutation.
- **Personal vs Work Account Separation**: A personal context strictly forbids access to organizational teams, channels, files, and member directories.

---

## 2. Authentication & Session Hardening

1. **Password Hashing**: PBKDF2 with SHA-256 (Django standard, 720,000 iterations).
2. **Token Handling**:
   - Web: Stored in memory or secure HTTP-only cookies where applicable.
   - Mobile: Stored in encrypted mobile storage (Keystore / Keyring).
3. **OTP Security**:
   - Expiration: 10 minutes.
   - Max failed attempts: 5 (locks out token after 5 failed verification attempts).
   - One-time use: Marked `is_verified=True` and rejected on subsequent attempts.
   - Plain text code is hashed before persistence.
4. **Rate Limiting & Brute Force Defense**: Login and OTP endpoints enforce IP and identity rate limiting.

---

## 3. Role-Based & Policy-Based Access Control (RBAC & PBAC)

Permissions are calculated based on three intersecting criteria:
1. **Business Role**: Admin, Manager, HR, Team Leader, Employee (`tc_business_roles`).
2. **Team Role**: Owner vs Member (`tc_team_memberships`).
3. **Organization Policy**: Granular flags in `tc_organization_policies`:
   - `team_owner_can_add_users`
   - `team_owner_can_create_teams_channels`
   - `user_can_create_teams_channels`

### Permission Matrix

| Action | Admin | Team Owner (Policies True) | Team Owner (Policies False) | Member (Policies True) | Member (Policies False) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| Create Team | Yes | Yes | No | Yes | No |
| Add Team Member | Yes | Yes | No | No | No |
| Archive Team | Yes | Yes | Yes | No | No |
| Create Channel | Yes | Yes | No | Yes | No |
| Delete Message (Own) | Yes | Yes | Yes | Yes | Yes |
| Delete Message (Others)| Yes | Yes (in team) | Yes (in team) | No | No |

---

## 4. LiveKit Video/Audio Security

- The LiveKit API Secret is strictly kept on the Django backend; it is **never** exposed to client applications.
- Tokens issued by `/api/v1/meetings/join/` have an expiration window of 60 minutes and restrict room permissions to the specific room ID requested.
- Guests are restricted to the specific meeting room and cannot access organizational channels or user profiles.
