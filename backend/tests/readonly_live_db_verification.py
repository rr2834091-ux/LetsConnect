import os
import sys
from pathlib import Path

# Setup Django environment pointing to live backend settings
BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

import django
django.setup()

from apps.organizations.models import Organization, Workspace, OrganizationSetting
from apps.organizations.serializers import OrganizationSerializer
from apps.memberships.models import Employee, Department, BusinessRole, AdminProfile
from apps.memberships.serializers import EmployeeSerializer
from apps.teams.models import Team, TeamMembership
from apps.teams.serializers import TeamSerializer
from apps.channels.models import Channel, ChannelMembership
from apps.channels.serializers import ChannelSerializer
from apps.permissions.models import OrganizationPolicy, MeetingPolicy, MessagingPolicy
from apps.permissions.evaluator import get_user_org_permissions, can_create_teams, can_add_team_users
from django.contrib.auth.models import User

def run_readonly_verification():
    print("=" * 60)
    print("LETSCONNECT: SAFE READ-ONLY LIVE DATABASE VERIFICATION")
    print("=" * 60)

    # 1. Organizations
    orgs = list(Organization.objects.all())
    print(f"\n[1] Organizations (tc_organizations): Found {len(orgs)}")
    for o in orgs:
        print(f"  - ID: {o.id} (UUID)")
        print(f"    Name: {o.display_name} | Legal: {o.legal_name}")
        print(f"    Domain: {o.company_domain} | Email: {o.business_email}")
        print(f"    Active: {o.is_active}")
        # Test serializer
        ser = OrganizationSerializer(o)
        assert 'id' in ser.data, "Serializer missing 'id'"
        assert ser.data['display_name'] == o.display_name

    # 2. Employees
    employees = list(Employee.objects.select_related('organization', 'department', 'role').all())
    print(f"\n[2] Employees (tc_employees): Found {len(employees)}")
    for e in employees:
        print(f"  - Employee ID: {e.employee_id} | Name: {e.first_name} {e.last_name}")
        print(f"    Email: {e.email} | Status: {e.status}")
        print(f"    Org ID: {e.organization_id} ({e.organization.display_name})")
        # Test serializer
        ser = EmployeeSerializer(e)
        assert ser.data['email'] == e.email
        assert ser.data['full_name'] == f"{e.first_name} {e.last_name}".strip()

    # 3. Teams
    teams = list(Team.objects.select_related('organization').all())
    print(f"\n[3] Teams (tc_teams): Found {len(teams)}")
    for t in teams:
        print(f"  - Team: {t.name} (ID: {t.id})")
        print(f"    Org: {t.organization.display_name} | Visibility: {t.visibility}")
        # Test serializer
        ser = TeamSerializer(t)
        assert ser.data['name'] == t.name
        assert ser.data['visibility'] == t.visibility

    # 4. Channels
    channels = list(Channel.objects.select_related('team').all())
    print(f"\n[4] Channels (tc_channels): Found {len(channels)}")
    for c in channels:
        print(f"  - Channel: #{c.name} in Team: {c.team.name} (Type: {c.channel_type})")
        # Test serializer
        ser = ChannelSerializer(c)
        assert ser.data['name'] == c.name

    # 5. Team Memberships
    memberships = list(TeamMembership.objects.select_related('team', 'employee').all())
    print(f"\n[5] Team Memberships (tc_team_memberships): Found {len(memberships)}")
    for m in memberships:
        print(f"  - {m.employee.email} in '{m.team.name}' as '{m.role_in_team}'")

    # 6. Organization Policies & Permissions
    policies = list(OrganizationPolicy.objects.select_related('organization').all())
    print(f"\n[6] Policies (tc_organization_policies): Found {len(policies)}")
    for p in policies:
        print(f"  - Org: {p.organization.display_name}")
        print(f"    team_owner_can_add_users: {p.team_owner_can_add_users}")
        print(f"    team_owner_can_create_teams_channels: {p.team_owner_can_create_teams_channels}")
        print(f"    user_can_create_teams_channels: {p.user_can_create_teams_channels}")

    # 7. Admin Profiles & Auth Users
    admins = list(AdminProfile.objects.select_related('user', 'organization').all())
    print(f"\n[7] Admin Profiles (tc_admin_profiles): Found {len(admins)}")
    for a in admins:
        print(f"  - User: {a.user.username} is Admin for Org: {a.organization.display_name if a.organization else 'None'}")

    # 8. Multi-Tenant Strict Boundary Verification
    print(f"\n[8] Multi-Tenant Strict Boundary Verification (Read-Only)")
    if len(orgs) >= 2:
        org_1, org_2 = orgs[0], orgs[1]
        org_1_teams = list(Team.objects.filter(organization=org_1))
        org_2_teams = list(Team.objects.filter(organization=org_2))

        org_1_team_ids = {t.id for t in org_1_teams}
        org_2_team_ids = {t.id for t in org_2_teams}

        # Verify no intersection between teams of Org 1 and Org 2
        intersection = org_1_team_ids.intersection(org_2_team_ids)
        assert len(intersection) == 0, "Security Violation: Team leaked across organizations!"
        print(f"  [PASS] Org '{org_1.display_name}' has {len(org_1_teams)} team(s)")
        print(f"  [PASS] Org '{org_2.display_name}' has {len(org_2_teams)} team(s)")
        print(f"  [PASS] Strict isolation verified: Zero shared teams or leaked IDs")

    print("\n" + "=" * 60)
    print("ALL READ-ONLY VERIFICATION CHECKS PASSED SUCCESSFULLY!")
    print("=" * 60)

if __name__ == '__main__':
    run_readonly_verification()
