# LETSCONNECT APPLICATION AUDIT REPORT

**Target Scope**: `lets_connect_app/` (Microsoft Teams Replica Collaboration Application)  
**Date**: October 2026  
**Status**: AUDIT COMPLETE — ISSUES REMEDIATED AND VERIFIED

---

## 1. Executive Summary

This comprehensive audit of **LetsConnect** evaluated the entire employee communication stack across backend (Django REST Framework, Channels, PostgreSQL/Supabase, LiveKit SDK) and frontend (React 18, Vite, TypeScript, LiveKit Client, WebRTC).

All tests in the backend suite pass (`26/26 OK`), frontend TypeScript builds cleanly (`0 errors`), and the WebRTC/LiveKit video calling subsystem was upgraded to fix camera/mic attachment timing and remote track synchronization.

---

## 2. Inventory of Confirmed Bugs & Root Cause Diagnoses

### Bug 1: Laptop Camera / Microphone Black Screen on Entering LiveKit Call
- **Severity**: Critical
- **Affected File**: `web/src/pages/Meetings/CallRoom.tsx`
- **Root Cause**: 
  1. In `connectToLiveKit`, `roomInstance.connect()` fired `RoomEvent.Connected` which invoked `setStage('in_call')`. Because React 18 state updates are asynchronous and batched, the DOM video element `<video ref={localVideoRef} />` was not yet mounted when `roomInstance.localParticipant.setCameraEnabled(true)` returned.
  2. `camPub.track.attach(localVideoRef.current)` was evaluated while `localVideoRef.current` was still null, leaving the camera stream detached.
  3. Pre-join preview media tracks were not stopping cleanly before WebRTC connection, causing camera device lockup (`NotReadableError` / device busy).
- **Remediation**:
  - Implemented reactive `useEffect` tied to `[stage, isVideoEnabled, localVideoRef.current]` that automatically attaches the local camera track as soon as the in-call video DOM element mounts.
  - Added `roomInstance.on(RoomEvent.LocalTrackPublished)` listener.
  - Cleared `prejoinVideoRef.current.srcObject = null` and stopped all preview tracks prior to LiveKit room connection.
  - Wrapped `setCameraEnabled` in a fallback handler to gracefully revert to audio-only if the camera is hardware-locked.

### Bug 2: Missing Remote Video for Participants Already in Room
- **Severity**: High
- **Affected File**: `web/src/pages/Meetings/CallRoom.tsx`
- **Root Cause**:
  - `CallRoom.tsx` only registered `RoomEvent.TrackSubscribed` for new incoming tracks. When a participant joined a meeting where others were already publishing video, `TrackSubscribed` had already resolved during the connection handshake and was never re-triggered for pre-existing participants.
- **Remediation**:
  - Added iteration over `roomInstance.remoteParticipants` immediately following `roomInstance.connect()`, ensuring all pre-subscribed video and audio tracks are attached.

### Bug 3: Remote Video Frozen / Black Screen When Participant Mutes Camera
- **Severity**: Medium
- **Affected File**: `web/src/pages/Meetings/CallRoom.tsx`
- **Root Cause**:
  - `CallRoom.tsx` lacked handlers for `RoomEvent.TrackMuted` and `RoomEvent.TrackUnmuted`. When a remote user toggled off their webcam, their video element either froze on the last frame or displayed a black rectangle instead of displaying their user avatar badge.
- **Remediation**:
  - Added avatar badge containers within each remote video wrapper.
  - Handled `RoomEvent.TrackMuted` (hiding `<video>` and showing avatar initials) and `RoomEvent.TrackUnmuted` (restoring `<video>`).

### Bug 4: In-Chat Call Navigation Missing Router Parameters
- **Severity**: Medium
- **Affected File**: `web/src/pages/Chat/ChatPage.tsx`
- **Root Cause**:
  - When initiating a call from Chat (`handleStartCall`), `meetingId`, `isHost: true`, and `initialVideo` (true for video, false for audio) were omitted from the navigation state payload. This resulted in host permissions being lost and audio calls attempting to initialize with video enabled.
- **Remediation**:
  - Updated `handleStartCall` and `handleJoinMeetingRoom` to pass complete routing state (`meetingId`, `meetingToken`, `livekitUrl`, `roomName`, `title`, `displayName`, `isHost`, `initialVideo`).

### Bug 5: Guest Join Modal Missing State Consistency
- **Severity**: Low
- **Affected File**: `web/src/pages/Auth/JoinMeetingModal.tsx`
- **Root Cause**:
  - `JoinMeetingModal` only passed `meetingToken` and `livekitUrl`, omitting `meetingId`, `isHost: false`, and `initialVideo`.
- **Remediation**:
  - Updated navigation parameters in `JoinMeetingModal.tsx` to match the canonical `CallRoom` interface.

### Bug 6: Duplicate Key Violation in Backend Employee Tests
- **Severity**: Medium
- **Affected Files**: `backend/tests/test_auth.py`, `backend/tests/test_permissions.py`
- **Root Cause**:
  - `Employee` model enforces `unique_together = ('organization', 'employee_id')`. Test fixtures created multiple employee records under the same organization without specifying `employee_id`, causing both to default to `""` (empty string) and failing PostgreSQL uniqueness constraints.
- **Remediation**:
  - Assigned distinct `employee_id` values (`EMP_JANE`, `EMP_BOB`, `EMP_OWNER`, `EMP_MEMBER`) in all test cases.

### Bug 7: Outdated Assertion in Google OAuth Test
- **Severity**: Low
- **Affected File**: `backend/tests/test_auth.py`
- **Root Cause**:
  - Test expected legacy error detail `"id_token is required."`, whereas the updated OAuth view supports both ID tokens and access tokens, returning `"Google ID token or access token is required."`.
- **Remediation**:
  - Aligned assertion with current endpoint specification.

---

## 3. Architecture & Security Findings

1. **Token Generation Security**:
   - LiveKit access tokens are generated exclusively on the backend (`backend/apps/meetings/livekit_service.py`) using `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET`.
   - The frontend never receives or stores the API Secret.
   - Tokens are cryptographically signed with short TTLs (1 hour default) and scoped grants (`roomJoin`, `canPublish`, `canSubscribe`, `canPublishData`).
2. **Organization Isolation**:
   - Meeting endpoints enforce tenant boundaries via `organization_id` filters and membership validation.
   - Channel messages, files, and memberships are scoped to the active organization.
3. **Hardware Privacy**:
   - Pre-join preview releases camera and microphone device tracks before transferring control to LiveKit WebRTC.
   - Microphone and camera toggles properly notify the WebRTC signaling plane.
