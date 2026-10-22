# LetsConnect — Automated Testing Strategy & Acceptance Criteria

## 1. Test Architecture

The testing suite covers:
1. **Backend Integration Tests** (`backend/tests/`):
   - Multi-tenant data isolation tests: Verify that Tenant A users cannot read, list, or mutate Tenant B records.
   - Dynamic permission policy tests: Verify that toggling `team_owner_can_add_users` or `team_owner_can_create_teams_channels` immediately permits or denies actions.
   - Authentication & Context tests: Verify personal vs work account isolation.
   - LiveKit token generation tests: Scoped permissions, room names, and expiry validation.
   - Messaging & WebSocket consumer tests.

2. **Frontend Tests** (`web/tests/`):
   - Component rendering and state tests.
   - Navigation and route guard tests.
   - API client mock integration tests.

---

## 2. Running Automated Tests

### Running Backend Tests
From the `backend/` directory:
```bash
python manage.py test tests
```
or with pytest:
```bash
pytest tests/
```

### Running Frontend Tests
From the `web/` directory:
```bash
npm run test
```
