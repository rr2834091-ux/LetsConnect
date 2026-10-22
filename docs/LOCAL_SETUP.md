# LetsConnect — Local Development Setup Guide

## 1. Prerequisites
- **Python**: 3.12+ (tested with Python 3.14.3)
- **Node.js**: v20+ (tested with Node v24.21.0)
- **npm**: 10+
- **Supabase PostgreSQL Database**: Existing shared instance running on port 5432.

---

## 2. Backend Setup (Django + ASGI Channels)

### Step 1: Navigate to Backend Directory
```bash
cd backend
```

### Step 2: Configure Environment Variables
Copy `.env.example` to `.env` and verify settings:
```bash
cp .env.example .env
```
Ensure `DATABASE_URL` matches your Supabase connection string.

### Step 3: Install Python Dependencies
```bash
pip install -r requirements.txt
```

### Step 4: Run Database Migrations
Apply LetsConnect additive migrations:
```bash
python manage.py migrate
```

### Step 5: Start Backend Development Server (Daphne / Django)
```bash
python manage.py runserver 8000
```
The REST API will be available at `http://127.0.0.1:8000/api/v1/` and WebSockets at `ws://127.0.0.1:8000/ws/connect/`.

---

## 3. Web Frontend Setup (React + Vite)

### Step 1: Navigate to Web Directory
```bash
cd web
```

### Step 2: Install Node Dependencies
```bash
npm install
```

### Step 3: Start Vite Dev Server
```bash
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## 4. Android Mobile Application Setup (React Native)

### Step 1: Navigate to Mobile Directory
```bash
cd mobile
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Start Metro Bundler
```bash
npm start
```

### Step 4: Run on Android Emulator / Connected Device
```bash
npm run android
```
Note: Ensure Android Studio and Android SDK 34+ are installed and your emulator or connected device has USB debugging enabled.
