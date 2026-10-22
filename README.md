# LetsConnect — Enterprise Collaboration Platform

LetsConnect is a production-grade collaboration platform inspired by Microsoft Teams, built from scratch with a unified multi-tenant backend, React web client, and React Native Android mobile client.

---

## 🌟 Key Features

- **Multi-Tenant Architecture**: Dynamic integration with existing Supabase PostgreSQL shared with Admin Centre. Adding new organizations dynamically requires zero code changes.
- **Dual Account Contexts**: Distinct Personal and Work account profiles with seamless context switching.
- **Team & Channel Collaboration**: Real-time channel discussions, private teams, membership access, and role delegations.
- **Real-Time Messaging**: WebSockets-backed 1:1 direct messages, group chats, threaded replies, emoji reactions, typing indicators, and attachments.
- **Dynamic Presence & Availability**: Real-time status sync (`Available`, `Busy`, `DND`, `Away`, `Be Right Back`, `Appear Offline`) with inactivity triggers.
- **Audio & Video Conferencing**: LiveKit Cloud WebRTC integration for group meetings, screen sharing, camera/mic controls, and guest meeting access.
- **Security & Authorization**: Server-side PBAC/RBAC enforcing Admin Centre policies with absolute cross-tenant isolation.

---

## 📂 Repository Structure

```
LetsConnect/
├── backend/                  # Django 5 + Channels + DRF Backend
│   ├── config/               # ASGI/WSGI settings & URL routing
│   ├── apps/                 # Modular Django apps
│   │   ├── accounts/         # Identity, Personal/Work Auth, OTP
│   │   ├── organizations/    # Dynamic multi-tenant organization context
│   │   ├── memberships/      # Membership resolution & switching
│   │   ├── teams/            # Teams management & ownership
│   │   ├── channels/         # Channel management & access control
│   │   ├── messaging/        # Persistent chat, threads & reactions
│   │   ├── presence/         # Real-time availability & heartbeats
│   │   ├── meetings/         # LiveKit tokens, rooms & guest access
│   │   ├── notifications/    # In-app alerts & reminders
│   │   ├── files/            # Storage abstraction (Supabase/S3)
│   │   ├── permissions/      # Server-side policy authorization engine
│   │   └── audit/            # Audit logging & event tracking
│   ├── tests/                # Automated backend test suites
│   ├── manage.py
│   └── requirements.txt
├── web/                      # React 19 + Vite + TypeScript Web Client
│   ├── src/                  # App components, pages, hooks & state
│   └── package.json
├── mobile/                   # React Native Android Mobile Application
│   ├── src/                  # Navigation, screens, features & state
│   └── package.json
└── docs/                     # Comprehensive architecture & design docs
    ├── ARCHITECTURE.md
    ├── DATABASE.md
    ├── API.md
    ├── SECURITY.md
    ├── LOCAL_SETUP.md
    ├── DEPLOYMENT.md
    ├── TESTING.md
    └── AWS_MIGRATION.md
```

---

## 🚀 Quick Start

### 1. Backend
```bash
cd backend
python -m pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 8000
```

### 2. Web Client
```bash
cd web
npm install
npm run dev
```

### 3. Android Mobile
```bash
cd mobile
npm install
npm run android
```
