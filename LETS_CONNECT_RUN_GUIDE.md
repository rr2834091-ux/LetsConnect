# LETSCONNECT EXECUTION & OPERATION GUIDE

**Target Scope**: `letsconnectapp/lets_connect_app/`  
**Operating System**: Windows (PowerShell)  
**Date**: October 2026

---

## 1. Prerequisites Checklist

Before launching the servers, verify the following dependencies:
- **Python**: 3.10+ (Current: Python 3.14 on system PATH)
- **Node.js & npm**: Node 18+ (Current: Node & npm verified)
- **Supabase PostgreSQL Database**: Configured in `backend/.env`
- **LiveKit Cloud Credentials**: Configured in `backend/.env` and `web/.env`

---

## 2. Starting the Backend Server

Open a Windows PowerShell terminal:

```powershell
# Navigate to the backend directory
cd "d:\letsconnectapp (4)\letsconnectapp\lets_connect_app\backend"

# Run system checks to verify database connectivity
python manage.py check

# Run automated tests to verify API endpoints
python manage.py test --settings=config.settings_test

# Start the Django API and Channels WebSocket server on port 8001
# (Note: Using port 8001 keeps it clean and avoids port collisions)
python manage.py runserver 127.0.0.1:8001
```

> **Note**: If you want ASGI / WebSockets for live notifications, you can also run:
> ```powershell
> daphne -b 127.0.0.1 -p 8001 config.asgi:application
> ```

---

## 3. Starting the Frontend Web Application

Open a second Windows PowerShell terminal:

```powershell
# Navigate to the web frontend directory
cd "d:\letsconnectapp (4)\letsconnectapp\lets_connect_app\web"

# Verify build integrity
npm run build

# Start the Vite development server on port 5174 (or configured Vite port)
npm run dev
```

The Vite dev server will report a local URL, typically:
`http://localhost:5174/` or `http://localhost:5173/`

---

## 4. Testing End-to-End LiveKit Video & Audio Calling

### Step 1: Pre-Join Hardware Verification
1. Log in or click **Join a meeting as guest** on the login page.
2. In the pre-join screen:
   - Verify that your camera feed appears in the video preview box.
   - Click the camera button to toggle camera preview on/off.
   - Click the microphone button to toggle audio preview on/off.

### Step 2: In-Call Verification
1. Click **Join now**.
2. Notice the instant transition into the call room:
   - Your local webcam appears immediately in the primary video tile without a black screen or detached video element.
   - Your name badge appears in the bottom-left corner of your video box.
   - Toggle the **Camera** button in the floating bottom toolbar: your video hides cleanly and your avatar badge appears. Toggle it back on: your live webcam stream resumes smoothly.
   - Toggle the **Microphone** button: verify the muted indicator displays and signaling updates.
   - Click the **Screen Share** icon: select a window or full screen to share your display with the room.
   - Click the **Reactions** emoji button: choose an emoji (e.g. 👍, ❤️, 🎉) and observe the animated floating reaction overlay.

### Step 3: Multi-Party Simulation
1. Open an Incognito / Private window in your browser (or a second browser such as Edge/Chrome).
2. Navigate to `http://localhost:5174/login` and click **Join a meeting as guest**.
3. Enter the same **Meeting ID** (or Room name) and enter a guest name (e.g. "Colleague Beta").
4. Click **Join**:
   - Both windows will immediately display each other's remote video tiles in the video gallery.
   - When User A talks, User B receives the WebRTC audio stream.
   - When User A sends an emoji reaction, User B sees the reaction bubble float up in real time.
   - When the Host clicks **Leave** -> **End Meeting for All**, all participant sessions disconnect and return to the dashboard.
