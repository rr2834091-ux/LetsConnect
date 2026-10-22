import os
import sys
import json
import uuid

# Set up Django environment with live settings
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

import django
django.setup()

from django.contrib.auth.models import User
from rest_framework.test import APIClient
from apps.organizations.models import Organization
from apps.teams.models import Team, TeamMembership
from apps.channels.models import Channel
from apps.memberships.models import Employee, AdminProfile

def run_tests():
    print("=" * 70)
    print("LETSCONNECT: SAFE READ-ONLY API ENDPOINT & SECURITY TEST SUITE")
    print("=" * 70)

    client = APIClient()

    # Retrieve live entities
    org_tp = Organization.objects.filter(display_name='tp').first()
    org_fg = Organization.objects.filter(display_name='fg').first()
    user_tp = User.objects.filter(email='kabileshk159@gmail.com').first()
    user_fg = User.objects.filter(email='kabileshk302@gmail.com').first()

    assert org_tp is not None, "Org tp not found"
    assert org_fg is not None, "Org fg not found"
    assert user_tp is not None, "User kabileshk159@gmail.com not found"
    assert user_fg is not None, "User kabileshk302@gmail.com not found"

    tp_id = str(org_tp.id)
    fg_id = str(org_fg.id)

    team_dev = Team.objects.filter(organization=org_tp, name='development').first()
    team_public = Team.objects.filter(organization=org_tp, name='General Org Team').first()
    dev_id = str(team_dev.id) if team_dev else None
    public_id = str(team_public.id) if team_public else None

    results = []

    def record(category, test_name, status_code, expected_status, passed, detail=""):
        status_str = "PASS" if passed else "FAIL"
        results.append({
            "category": category,
            "test_name": test_name,
            "status_code": status_code,
            "expected_status": expected_status,
            "passed": passed,
            "detail": detail
        })
        print(f"[{status_str}] [{category}] {test_name}: Code={status_code} (Expected {expected_status}) {detail}")

    # -------------------------------------------------------------
    # SUITE 1: UNAUTHENTICATED REQUESTS (MUST RETURN 401 UNAUTHORIZED)
    # -------------------------------------------------------------
    print("\n--- SUITE 1: UNAUTHENTICATED REQUEST REJECTION ---")
    client.logout()

    unauth_endpoints = [
        ("GET /api/v1/organizations/", "/api/v1/organizations/"),
        ("GET /api/v1/organizations/{id}/", f"/api/v1/organizations/{tp_id}/"),
        ("GET /api/v1/teams/?organization_id={id}", f"/api/v1/teams/?organization_id={tp_id}"),
        ("GET /api/v1/teams/{id}/", f"/api/v1/teams/{dev_id}/"),
        ("GET /api/v1/channels/?team_id={id}", f"/api/v1/channels/?team_id={dev_id}"),
        ("GET /api/v1/memberships/directory/?organization_id={id}", f"/api/v1/memberships/directory/?organization_id={tp_id}"),
        ("GET /api/v1/permissions/check/?organization_id={id}", f"/api/v1/permissions/check/?organization_id={tp_id}"),
        ("GET /api/v1/messaging/conversations/?organization_id={id}", f"/api/v1/messaging/conversations/?organization_id={tp_id}"),
        ("GET /api/v1/files/?organization_id={id}", f"/api/v1/files/?organization_id={tp_id}"),
        ("GET /api/v1/meetings/?organization_id={id}", f"/api/v1/meetings/?organization_id={tp_id}"),
    ]

    for name, path in unauth_endpoints:
        resp = client.get(path)
        passed = (resp.status_code == 401)
        record("Unauthenticated", name, resp.status_code, 401, passed)

    # -------------------------------------------------------------
    # SUITE 2: MISSING PARAMETERS / INVALID IDS
    # -------------------------------------------------------------
    print("\n--- SUITE 2: MISSING PARAMETERS & INVALID IDENTIFIERS ---")
    client.force_authenticate(user=user_tp)

    missing_param_tests = [
        ("Teams query without organization_id", "/api/v1/teams/", 400),
        ("Channels query without team_id", "/api/v1/channels/", 400),
        ("Member directory without organization_id", "/api/v1/memberships/directory/", 400),
        ("Permissions check without organization_id", "/api/v1/permissions/check/", 400),
    ]
    for name, path, exp_code in missing_param_tests:
        resp = client.get(path)
        passed = (resp.status_code == exp_code)
        record("Parameter Validation", name, resp.status_code, exp_code, passed)

    random_uuid = str(uuid.uuid4())
    invalid_id_tests = [
        ("Org detail with non-existent UUID", f"/api/v1/organizations/{random_uuid}/", 404),
        ("Team detail with non-existent UUID", f"/api/v1/teams/{random_uuid}/", 404),
        ("Channels with non-existent team UUID", f"/api/v1/channels/?team_id={random_uuid}", 404),
        ("Employee detail with non-existent UUID", f"/api/v1/memberships/directory/{random_uuid}/", 404),
    ]
    for name, path, exp_code in invalid_id_tests:
        resp = client.get(path)
        passed = (resp.status_code == exp_code)
        record("Invalid ID Handling", name, resp.status_code, exp_code, passed)

    # -------------------------------------------------------------
    # SUITE 3: STRICT CROSS-ORGANIZATION ISOLATION (USER_FG vs ORG_TP)
    # -------------------------------------------------------------
    print("\n--- SUITE 3: CROSS-ORGANIZATION DATA ISOLATION (Org fg User -> Org tp Resources) ---")
    client.force_authenticate(user=user_fg)

    # 1. User fg queries organizations: MUST only see fg, tp MUST NOT appear
    resp = client.get("/api/v1/organizations/")
    data = resp.data
    if isinstance(data, dict) and 'results' in data:
        org_items = data['results']
    elif isinstance(data, list):
        org_items = data
    else:
        org_items = []
    org_ids_returned = [str(o.get('id')) for o in org_items if isinstance(o, dict)]
    passed_org_list = (resp.status_code == 200 and fg_id in org_ids_returned and tp_id not in org_ids_returned)
    record("Cross-Org Isolation", "User fg lists organizations (tp hidden)", resp.status_code, 200, passed_org_list,
           f"Returned count: {len(org_items)}, contains fg: {fg_id in org_ids_returned}, contains tp: {tp_id in org_ids_returned}")

    # 2. User fg attempts to access tp organization detail directly
    resp = client.get(f"/api/v1/organizations/{tp_id}/")
    passed = (resp.status_code == 404)
    record("Cross-Org Isolation", "User fg requests Org tp detail directly", resp.status_code, 404, passed)

    # 3. User fg attempts to query teams in Org tp
    resp = client.get(f"/api/v1/teams/?organization_id={tp_id}")
    passed = (resp.status_code == 403)
    record("Cross-Org Isolation", "User fg requests teams in Org tp", resp.status_code, 403, passed)

    # 4. User fg attempts to query channels in team_dev (which is in Org tp)
    resp = client.get(f"/api/v1/channels/?team_id={dev_id}")
    passed = (resp.status_code == 403)
    record("Cross-Org Isolation", "User fg requests channels of Org tp private team", resp.status_code, 403, passed)

    # 5. User fg attempts to access employee directory of Org tp
    resp = client.get(f"/api/v1/memberships/directory/?organization_id={tp_id}")
    passed = (resp.status_code == 403)
    record("Cross-Org Isolation", "User fg requests employee directory of Org tp", resp.status_code, 403, passed)

    # 6. User fg attempts to access conversations in Org tp
    resp = client.get(f"/api/v1/messaging/conversations/?organization_id={tp_id}")
    conv_data = resp.data if hasattr(resp, 'data') else []
    conv_count = len(conv_data) if isinstance(conv_data, list) else (len(conv_data.get('results', [])) if isinstance(conv_data, dict) else -1)
    passed = (resp.status_code == 200 and conv_count == 0)
    record("Cross-Org Isolation", "User fg requests conversations in Org tp (empty list)", resp.status_code, 200, passed, f"Returned: {conv_count}")

    # 7. Check if EmployeeDetailView allows viewing an employee from another org
    emp_tp = Employee.objects.filter(organization=org_tp).first()
    if emp_tp:
        resp = client.get(f"/api/v1/memberships/directory/{emp_tp.id}/")
        # Let's inspect the behavior
        is_isolated = (resp.status_code in [403, 404])
        record("Cross-Org Isolation", f"User fg requests individual employee profile of Org tp ({emp_tp.email})",
               resp.status_code, 403, is_isolated, "Tests if employee detail endpoint leaks cross-org employee profiles")

    # 8. Check if TeamDetailView allows viewing a team from another org directly
    resp = client.get(f"/api/v1/teams/{dev_id}/")
    is_isolated = (resp.status_code in [403, 404])
    record("Cross-Org Isolation", f"User fg requests individual team detail of Org tp ({dev_id})",
           resp.status_code, 403, is_isolated, "Tests if team detail endpoint leaks cross-org teams")

    # 9. Check if FileListView checks organization membership
    resp = client.get(f"/api/v1/files/?organization_id={tp_id}")
    files_isolated = (resp.status_code in [403, 404])
    record("Cross-Org Isolation", "User fg queries file attachments in Org tp",
           resp.status_code, 403, files_isolated, "Tests if file list endpoint requires membership in the specified org")

    # 10. Check if MeetingListCreateView checks organization membership
    resp = client.get(f"/api/v1/meetings/?organization_id={tp_id}")
    meetings_isolated = (resp.status_code in [403, 404])
    record("Cross-Org Isolation", "User fg queries meetings in Org tp",
           resp.status_code, 403, meetings_isolated, "Tests if meetings list endpoint requires membership in the specified org")

    # -------------------------------------------------------------
    # SUITE 4: PERMISSION & POLICY EVALUATION (READ-ONLY)
    # -------------------------------------------------------------
    print("\n--- SUITE 4: PERMISSION EVALUATION & RBAC/PBAC CHECKS ---")

    # 1. User tp (Admin in Org tp)
    client.force_authenticate(user=user_tp)
    resp = client.get(f"/api/v1/permissions/check/?organization_id={tp_id}")
    tp_perms = resp.json() if resp.status_code == 200 else {}
    passed_tp_perms = (
        resp.status_code == 200 and
        tp_perms.get("is_org_admin") == True and
        tp_perms.get("can_create_teams") == True and
        tp_perms.get("team_owner_can_add_users") == True
    )
    record("Permissions Evaluation", "User tp has admin permissions in Org tp", resp.status_code, 200, passed_tp_perms,
           f"Admin: {tp_perms.get('is_org_admin')}, CreateTeams: {tp_perms.get('can_create_teams')}")

    # 2. User fg (Admin in Org fg)
    client.force_authenticate(user=user_fg)
    resp = client.get(f"/api/v1/permissions/check/?organization_id={fg_id}")
    fg_perms = resp.json() if resp.status_code == 200 else {}
    # In Org fg, tc_organization_policies has all false, but user_fg is AdminProfile in fg so is_org_admin is True
    passed_fg_perms = (
        resp.status_code == 200 and
        fg_perms.get("is_org_admin") == True
    )
    record("Permissions Evaluation", "User fg has admin permissions in Org fg", resp.status_code, 200, passed_fg_perms,
           f"Admin: {fg_perms.get('is_org_admin')}")

    # 3. User fg checking permissions in Org tp
    resp = client.get(f"/api/v1/permissions/check/?organization_id={tp_id}")
    # Should either be 403 or have all permissions as False
    data = resp.json() if resp.status_code == 200 else {}
    all_false = not any([data.get('is_org_admin'), data.get('can_create_teams'), data.get('can_create_channels'), data.get('can_add_team_users')])
    passed = (resp.status_code in [403, 404]) or (resp.status_code == 200 and all_false)
    record("Permissions Evaluation", "User fg gets zero permissions in Org tp", resp.status_code, "200 (all false) or 403", passed,
           f"All permissions false: {all_false}")

    # -------------------------------------------------------------
    # SUITE 5: AUTHORIZED READ QUERIES (VERIFY LEGITIMATE DATA ACCESSIBLE)
    # -------------------------------------------------------------
    print("\n--- SUITE 5: AUTHORIZED DATA RETRIEVAL FOR VALID USER ---")
    client.force_authenticate(user=user_tp)

    # 1. User tp gets Org tp detail
    resp = client.get(f"/api/v1/organizations/{tp_id}/")
    data = resp.data if hasattr(resp, 'data') and isinstance(resp.data, dict) else {}
    passed = (resp.status_code == 200 and str(data.get('id')) == tp_id)
    record("Authorized Access", "User tp fetches Org tp detail", resp.status_code, 200, passed)

    # 2. User tp lists teams in Org tp
    resp = client.get(f"/api/v1/teams/?organization_id={tp_id}")
    teams_data = resp.data if hasattr(resp, 'data') else []
    team_count = len(teams_data) if isinstance(teams_data, list) else (len(teams_data.get('results', [])) if isinstance(teams_data, dict) else 0)
    passed = (resp.status_code == 200 and team_count >= 2)
    record("Authorized Access", "User tp lists teams in Org tp", resp.status_code, 200, passed, f"Teams count: {team_count}")

    # 3. User tp lists channels in team_dev
    resp = client.get(f"/api/v1/channels/?team_id={dev_id}")
    ch_data = resp.data if hasattr(resp, 'data') else []
    channel_count = len(ch_data) if isinstance(ch_data, list) else (len(ch_data.get('results', [])) if isinstance(ch_data, dict) else 0)
    passed = (resp.status_code == 200 and channel_count >= 1)
    record("Authorized Access", "User tp lists channels in development team", resp.status_code, 200, passed, f"Channels count: {channel_count}")

    # 4. User tp gets employee directory for Org tp
    resp = client.get(f"/api/v1/memberships/directory/?organization_id={tp_id}")
    emp_data = resp.data if hasattr(resp, 'data') else []
    emp_count = len(emp_data) if isinstance(emp_data, list) else (len(emp_data.get('results', [])) if isinstance(emp_data, dict) else 0)
    passed = (resp.status_code == 200 and emp_count >= 3)
    record("Authorized Access", "User tp lists employee directory in Org tp", resp.status_code, 200, passed, f"Employee count: {emp_count}")

    # -------------------------------------------------------------
    # SUITE SUMMARY
    # -------------------------------------------------------------
    print("\n" + "=" * 70)
    print("TEST EXECUTION SUMMARY:")
    total = len(results)
    passed_cnt = sum(1 for r in results if r["passed"])
    failed_cnt = sum(1 for r in results if not r["passed"])
    print(f"TOTAL TESTS: {total} | PASSED: {passed_cnt} | FAILED: {failed_cnt}")
    print("=" * 70)

    if failed_cnt > 0:
        print("\nIDENTIFIED SECURITY GAPS / FAILURES TO REVIEW:")
        for r in results:
            if not r["passed"]:
                print(f" - [{r['category']}] {r['test_name']}: Status {r['status_code']} (Expected {r['expected_status']}) -> {r['detail']}")

    return results

if __name__ == '__main__':
    run_tests()
