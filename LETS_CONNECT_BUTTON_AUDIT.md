# LETSCONNECT INTERACTIVE CONTROL & BUTTON AUDIT

**Target Scope**: `letsconnectapp/lets_connect_app/`  
**Date**: October 2026  
**Auditor**: Senior Full-Stack & QA Automation Engineer

---

## 1. Authentication & Onboarding Controls (`/login`)

| Page / Component | Interactive Control | Handler / Action | API Endpoint Called | Defect Found | Resolution & Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `Login.tsx` | "Sign in to Work Account" | `handleSignIn` | `POST /api/v1/auth/login/` | None | Verified |
| `Login.tsx` | "Continue with Google" | Google Identity Services / Fallback | `POST /api/v1/auth/google/` | None | Verified |
| `Login.tsx` | "Forgot password?" | Inline help / modal prompt | N/A | None | Verified |
| `Login.tsx` | "First-time work account setup" | Opens `FirstTimeSetupModal` | `POST /api/v1/auth/first-time-setup/request/` | None | Verified |
| `Login.tsx` | "Join a meeting as guest" | Opens `JoinMeetingModal` | `POST /api/v1/meetings/join/` | Navigation state incomplete | Fixed — added `meetingId`, `isHost`, `initialVideo` |
| `FirstTimeSetupModal.tsx` | "Request Verification Code" | Step 1 submit | `POST /api/v1/auth/first-time-setup/request/` | None | Verified |
| `FirstTimeSetupModal.tsx` | "Verify & Set Password" | Step 2 submit | `POST /api/v1/auth/first-time-setup/verify/` | None | Verified |

---

## 2. Global Navigation & Layout (`TopBar.tsx`, `Sidebar.tsx`)

| Page / Component | Interactive Control | Handler / Action | API Endpoint Called | Defect Found | Resolution & Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `TopBar.tsx` | Organization Switcher | `switchOrganization(org.id)` | `POST /api/v1/auth/switch-context/` | None | Verified |
| `TopBar.tsx` | Presence Status Dropdown | `updatePresence(key)` | `POST /api/v1/presence/` | None | Verified |
| `TopBar.tsx` | Theme Toggle | `toggleTheme()` | Local state / CSS vars | None | Verified |
| `TopBar.tsx` | Profile Menu: "Sign Out" | `logout()` | `POST /api/v1/auth/logout/` | None | Verified |
| `TopBar.tsx` | Profile Menu: Context Switch | `switchContext('work' \| 'personal')` | `POST /api/v1/auth/switch-context/` | None | Verified |
| `Sidebar.tsx` | "Activity" NavLink | Navigate `/activity` | N/A | None | Verified |
| `Sidebar.tsx` | "Chat" NavLink | Navigate `/chat` | N/A | None | Verified |
| `Sidebar.tsx` | "Teams" NavLink | Navigate `/teams` | N/A | None | Verified |
| `Sidebar.tsx` | "Calendar" NavLink | Navigate `/meetings` | N/A | None | Verified |
| `Sidebar.tsx` | "Calls" NavLink | Navigate `/calls` | N/A | None | Verified |
| `Sidebar.tsx` | "Settings" NavLink | Navigate `/settings` | N/A | None | Verified |

---

## 3. Meetings & Video Calling Controls (`MeetingsPage.tsx`, `CallRoom.tsx`, `CallsPage.tsx`)

| Page / Component | Interactive Control | Handler / Action | API Endpoint Called | Defect Found | Resolution & Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `MeetingsPage.tsx` | "Meet Now" Button | `handleStartMeetNow` | `POST /api/v1/meetings/` + `POST /api/v1/meetings/join/` | None | Verified |
| `MeetingsPage.tsx` | "Join with an ID" Button | `handleJoinWithId` | `POST /api/v1/meetings/join/` | None | Verified |
| `MeetingsPage.tsx` | "New meeting" Button | `openNewMeetingModal` | `POST /api/v1/meetings/` | None | Verified |
| `MeetingsPage.tsx` | Calendar View Switcher (Day/Week/Month) | `setViewMode` | Local state | None | Verified |
| `MeetingsPage.tsx` | Calendar Date Navigation (<, >, Today) | `handlePrev`, `handleNext`, `handleToday` | `GET /api/v1/meetings/` | None | Verified |
| `MeetingsPage.tsx` | Meeting Card "Join" Button | `handleJoinExistingMeeting` | `POST /api/v1/meetings/join/` | None | Verified |
| `MeetingsPage.tsx` | Meeting Card "Copy Invitation Link" | Clipboard API | N/A | None | Verified |
| `CallsPage.tsx` | "Audio Call" Button | `startCall(emp, false)` | `POST /api/v1/meetings/` + `join/` | None | Verified |
| `CallsPage.tsx` | "Video Call" Button | `startCall(emp, true)` | `POST /api/v1/meetings/` + `join/` | None | Verified |
| `CallRoom.tsx` | Pre-join Camera Toggle | `togglePrejoinVideo` | Local MediaStream | Device held open | Fixed — released before join |
| `CallRoom.tsx` | Pre-join Mic Toggle | `togglePrejoinAudio` | Local MediaStream | None | Verified |
| `CallRoom.tsx` | Pre-join "Join now" Button | `connectToLiveKit` | LiveKit Cloud WebRTC | Video stream detached | Fixed — added reactive track attachment |
| `CallRoom.tsx` | In-Call Mic Button | `toggleMic` | `room.localParticipant.setMicrophoneEnabled` | None | Verified |
| `CallRoom.tsx` | In-Call Camera Button | `toggleCam` | `room.localParticipant.setCameraEnabled` | Black screen on re-toggle | Fixed — track synchronized to DOM video |
| `CallRoom.tsx` | In-Call Screen Share Button | `toggleScreenShare` | `room.localParticipant.setScreenShareEnabled` | None | Verified |
| `CallRoom.tsx` | In-Call Reactions Button | `sendReaction(emoji)` | `room.localParticipant.publishData` | None | Verified |
| `CallRoom.tsx` | In-Call "Add People" Button | `openAddPeopleModal` | `GET /api/v1/memberships/directory/` | None | Verified |
| `CallRoom.tsx` | In-Call Invite Colleague Button | `handleInviteColleague` | `POST /api/v1/notifications/` | None | Verified |
| `CallRoom.tsx` | In-Call Leave / Hangup Button | `leaveMeeting` | `room.disconnect()` | Audio nodes lingering | Fixed — audio elements cleaned up |
| `CallRoom.tsx` | In-Call "End Meeting for All" | `endMeetingForAll` | `POST /api/v1/meetings/:id/end/` | None | Verified |

---

## 4. Chat & Messaging Controls (`ChatPage.tsx`)

| Page / Component | Interactive Control | Handler / Action | API Endpoint Called | Defect Found | Resolution & Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `ChatPage.tsx` | Send Message (Button / Enter) | `sendMessage` | `POST /api/v1/messaging/conversations/:id/messages/` | None | Verified |
| `ChatPage.tsx` | Attach File Button | File input trigger | `POST /api/v1/files/upload/` | None | Verified |
| `ChatPage.tsx` | Emoji Picker Button | `setShowEmojiPicker` | N/A | None | Verified |
| `ChatPage.tsx` | Header Video Call Button | `handleStartCall('video')` | `POST /api/v1/meetings/` + `join/` | Router state incomplete | Fixed — added `meetingId`, `isHost`, `initialVideo` |
| `ChatPage.tsx` | Header Audio Call Button | `handleStartCall('audio')` | `POST /api/v1/meetings/` + `join/` | Audio call enabled cam | Fixed — passed `initialVideo: false` |
| `ChatPage.tsx` | New Group Chat Button | `setIsNewGroupModalOpen` | `POST /api/v1/messaging/conversations/` | None | Verified |
| `ChatPage.tsx` | Messages / Media Tabs | `setActiveTab` | `GET /api/v1/files/?conversation_id=...` | None | Verified |

---

## 5. Teams & Channels Controls (`TeamsPage.tsx`)

| Page / Component | Interactive Control | Handler / Action | API Endpoint Called | Defect Found | Resolution & Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `TeamsPage.tsx` | "Create Team" Button | `setIsCreateTeamOpen` | `POST /api/v1/teams/` | None | Verified (permission-checked) |
| `TeamsPage.tsx` | "Add Channel" Button | `openCreateChannelModal` | `POST /api/v1/channels/` | None | Verified (permission-checked) |
| `TeamsPage.tsx` | "Add Member" Button | `openAddMemberModal` | `POST /api/v1/teams/:id/members/` | None | Verified |
| `TeamsPage.tsx` | Channel Message Send | `sendChannelMessage` | `POST /api/v1/channels/:id/messages/` | None | Verified |
| `TeamsPage.tsx` | Personal Community Create | `handleCreateCommunity` | `POST /api/v1/communities/` | None | Verified |
| `TeamsPage.tsx` | Personal Community Join | `handleJoinCommunity` | `POST /api/v1/communities/join/` | None | Verified |

---

## 6. Settings Controls (`SettingsPage.tsx`)

| Page / Component | Interactive Control | Handler / Action | API Endpoint Called | Defect Found | Resolution & Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `SettingsPage.tsx` | "Edit Profile" Button | `setIsEditingProfile` | `PATCH /api/v1/auth/profile/` | None | Verified |
| `SettingsPage.tsx` | Theme Mode Switch | `setTheme('light' \| 'dark')` | Context / CSS | None | Verified |
| `SettingsPage.tsx` | Organization Switcher Radio | `switchOrganization(org.id)` | `POST /api/v1/auth/switch-context/` | None | Verified |
| `SettingsPage.tsx` | "Sign out of all sessions" | `logout()` | `POST /api/v1/auth/logout/` | None | Verified |
