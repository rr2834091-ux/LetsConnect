# LIVEKIT INTEGRATION & WEBRTC CALLING REPORT

**Target Scope**: `letsconnectapp/lets_connect_app/`  
**Date**: October 2026  
**Status**: INTEGRATION CERTIFIED & PRODUCTION READY

---

## 1. LiveKit Infrastructure Configuration

- **Signaling Endpoint**: `wss://letsconnectapp-t5cid7jr.livekit.cloud`
- **Backend Configuration**:
  - `LIVEKIT_API_URL`: Verified configured in `backend/.env`.
  - `LIVEKIT_API_KEY`: Verified configured in `backend/.env`.
  - `LIVEKIT_API_SECRET`: Securely stored in `backend/.env`.
  - SDK: Official `livekit.api` Python SDK (`AccessToken`, `VideoGrants`).
- **Frontend Configuration**:
  - `VITE_LIVEKIT_URL`: Verified configured in `web/.env`.
  - Client SDK: `livekit-client` v2.x with native WebRTC transceiver support.
  - Security Verification: No LiveKit API secret is embedded in or exposed to the client bundle.

---

## 2. Token Generation & Role Authorization

### Backend Endpoint: `POST /api/v1/meetings/join/`
1. **Passcode & Room Validation**:
   - Matches by meeting UUID or unique `room_name`.
   - Rejects ended meetings (`is_ended: true`).
   - Verifies meeting passcode if configured.
2. **Participant Identity & Organization Scoping**:
   - Authenticated User: Uses `user.id`, full display name, and checks host/admin status.
   - Guest Attendee: Uses `guest_<uuid>`, verifies `allow_guest: true`, and assigns `attendee` role.
3. **Cryptographic Token Issuance**:
   - Employs `generate_livekit_token`:
     - `room_join=True`
     - `room=meeting.room_name`
     - `can_publish=True`
     - `can_subscribe=True`
     - `can_publish_data=True`
     - `room_admin=is_host`
     - TTL: 3600 seconds (1 hour).

---

## 3. Media Pipeline & Camera/Mic Subsystem

### Pre-join Stage
- **Device Enumeration**:
  - Checks `navigator.mediaDevices.enumerateDevices()` for available webcam and audio input hardware.
  - Automatically switches to audio-only if no camera device is present.
- **Hardware Cleanup on Join**:
  - Explicitly invokes `track.stop()` on all prejoin preview media tracks and clears `prejoinVideoRef.current.srcObject = null` before initiating LiveKit room connection, preventing hardware lockup (`NotReadableError`).

### In-Call WebRTC Stage
- **Reactive Video Attachment**:
  - A React `useEffect` watches `[stage, isVideoEnabled, localVideoRef.current]` and binds the camera track directly to `<video ref={localVideoRef} />` as soon as the in-call view finishes rendering.
  - Listens to `RoomEvent.LocalTrackPublished` to bind freshly published video tracks.
- **Microphone Mute / Unmute**:
  - Connected directly to `room.localParticipant.setMicrophoneEnabled(boolean)`.
  - UI button visually updates with active/muted states.
- **Camera Toggle**:
  - Connected directly to `room.localParticipant.setCameraEnabled(boolean)`.
  - Handles device errors gracefully without crashing the active session.
- **Screen Sharing**:
  - Calls `room.localParticipant.setScreenShareEnabled(boolean)`.
  - Captures display media stream with automatic track republishing.

### Multi-Participant Track Management
- **Existing Participants**:
  - Immediately following `room.connect()`, iterates through `room.remoteParticipants` and attaches already-subscribed tracks, solving the problem where joining participants could not see previous attendees.
- **Track Subscriptions**:
  - Listens to `RoomEvent.TrackSubscribed` and dynamically mounts remote video containers.
- **Mute / Unmute Synchronization**:
  - Handled via `RoomEvent.TrackMuted` and `RoomEvent.TrackUnmuted`.
  - Displays user avatar initials when video is muted and seamlessly switches back to live video when unmuted.
- **Remote Audio Elements**:
  - Appends audio elements for remote audio tracks and purges all `[id^="audio-"]` DOM elements on call disconnect.

### Real-Time In-Call Data Channel
- **Emoji Reactions**:
  - Broadcasts JSON packet `{ type: 'reaction', emoji, sender }` via `room.localParticipant.publishData` with reliable delivery.
  - Renders floating reaction bubbles on all connected participant screens.
- **In-Call File Sharing**:
  - Broadcasts `{ type: 'file_shared', file }` upon upload and updates the in-call files drawer.
- **Host Termination**:
  - Broadcasts `{ type: 'meeting_ended' }` and invokes `POST /api/v1/meetings/:id/end/` to dismiss all attendees simultaneously.
