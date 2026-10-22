# LetsConnect — Production Deployment Guide

## 1. Web Frontend Deployment (Vercel)

The React/Vite web application is optimized for zero-config static hosting on Vercel:
1. Connect repository to Vercel.
2. Set Root Directory to `web`.
3. Build Command: `npm run build`
4. Output Directory: `dist`
5. Configure Environment Variables:
   - `VITE_API_BASE_URL`: `https://api.yourdomain.com`
   - `VITE_WS_BASE_URL`: `wss://api.yourdomain.com`
   - `VITE_LIVEKIT_URL`: `wss://your-project.livekit.cloud`

---

## 2. Backend Deployment (Render / Docker / ECS)

LetsConnect backend requires Daphne ASGI server for concurrent WebSockets and REST requests.

### Dockerfile
```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
ENV PYTHONUNBUFFERED=1
EXPOSE 8000
CMD ["daphne", "-b", "0.0.0.0", "-p", "8000", "config.asgi:application"]
```

### Production Checklist
1. `DJANGO_DEBUG=False`
2. `DJANGO_SECRET_KEY`: High-entropy 64+ character random string.
3. `DJANGO_ALLOWED_HOSTS`: Domain names of production backend.
4. `CORS_ALLOWED_ORIGINS`: Production web URL (e.g., `https://connect.yourdomain.com`).
5. `CSRF_TRUSTED_ORIGINS`: Production web and backend origins.
6. Run `python manage.py collectstatic --noinput`.
