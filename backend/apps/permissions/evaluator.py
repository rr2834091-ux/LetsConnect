from apps.memberships.models import Employee, AdminProfile
from apps.permissions.models import OrganizationPolicy
from apps.teams.models import Team, TeamMembership

def is_org_admin(user, organization_id) -> bool:
    """
    Check if the user is an admin of the specified organization.
    """
    if not user or not user.is_authenticated:
        return False
    return AdminProfile.objects.filter(user=user, organization_id=organization_id).exists()

def get_employee_record(user, organization_id):
    """
    Resolve active employee record for this user in the specified organization.
    """
    if not user or not user.is_authenticated:
        return None
    return Employee.objects.filter(
        organization_id=organization_id,
        email__iexact=user.email,
        status='active'
    ).first()

def is_team_owner(user, team_id) -> bool:
    """
    Check if the user is an owner of the specified team.
    """
    try:
        team = Team.objects.get(id=team_id)
    except Team.DoesNotExist:
        return False

    if is_org_admin(user, team.organization_id):
        return True

    emp = get_employee_record(user, team.organization_id)
    if not emp:
        return False

    return TeamMembership.objects.filter(
        team=team,
        employee=emp,
        role_in_team='owner'
    ).exists()

def can_create_teams(user, organization_id) -> bool:
    """
    Evaluates whether the user can create teams in this organization:
    1. Org admin can always create teams.
    2. Any team owner in this org can create teams if team_owner_can_create_teams_channels is True.
    3. Normal employees can create teams if user_can_create_teams_channels is True.
    """
    if is_org_admin(user, organization_id):
        return True

    emp = get_employee_record(user, organization_id)
    if not emp:
        return False

    policy = OrganizationPolicy.objects.filter(organization_id=organization_id).first()
    if not policy:
        return False

    # If general user policy is enabled:
    if policy.user_can_create_teams_channels:
        return True

    # If user is a team owner of any team in this org, check team_owner_can_create_teams_channels
    if policy.team_owner_can_create_teams_channels:
        owns_any_team = TeamMembership.objects.filter(
            team__organization_id=organization_id,
            employee=emp,
            role_in_team='owner'
        ).exists()
        if owns_any_team:
            return True

    return False

def can_add_team_users(user, team_id) -> bool:
    """
    Evaluates whether the user can add users to this team:
    1. Org admin can always add users.
    2. Team owner can add users ONLY if team_owner_can_add_users is True in organization policy.
    3. Normal members can never add users.
    """
    try:
        team = Team.objects.get(id=team_id)
    except Team.DoesNotExist:
        return False

    if is_org_admin(user, team.organization_id):
        return True

    emp = get_employee_record(user, team.organization_id)
    if not emp:
        return False

    is_owner = TeamMembership.objects.filter(
        team=team,
        employee=emp,
        role_in_team='owner'
    ).exists()

    if not is_owner:
        return False

    policy = OrganizationPolicy.objects.filter(organization_id=team.organization_id).first()
    if policy and policy.team_owner_can_add_users:
        return True

    return False

def can_create_channels(user, team_id) -> bool:
    """
    Evaluates whether user can create channels in this team.
    """
    try:
        team = Team.objects.get(id=team_id)
    except Team.DoesNotExist:
        return False

    if is_org_admin(user, team.organization_id):
        return True

    emp = get_employee_record(user, team.organization_id)
    if not emp:
        return False

    is_owner = TeamMembership.objects.filter(
        team=team,
        employee=emp,
        role_in_team='owner'
    ).exists()

    policy = OrganizationPolicy.objects.filter(organization_id=team.organization_id).first()
    if not policy:
        return False

    if is_owner and policy.team_owner_can_create_teams_channels:
        return True

    if policy.user_can_create_teams_channels:
        # Check team settings: allow_member_create_channels
        return team.allow_member_create_channels

    return False

def get_user_org_permissions(user, organization_id) -> dict:
    """
    Computes summary permission flags for client state.
    """
    admin = is_org_admin(user, organization_id)
    emp = get_employee_record(user, organization_id)
    policy = OrganizationPolicy.objects.filter(organization_id=organization_id).first()

    team_owner_create = policy.team_owner_can_create_teams_channels if policy else False
    user_create = policy.user_can_create_teams_channels if policy else False
    team_owner_add_users = policy.team_owner_can_add_users if policy else False

    is_any_team_owner = False
    if emp:
        is_any_team_owner = TeamMembership.objects.filter(
            team__organization_id=organization_id,
            employee=emp,
            role_in_team='owner'
        ).exists()

    return {
        "is_org_admin": admin,
        "is_team_owner": is_any_team_owner,
        "can_create_teams": admin or user_create or (is_any_team_owner and team_owner_create),
        "team_owner_can_add_users": team_owner_add_users,
        "team_owner_can_create_teams_channels": team_owner_create,
        "user_can_create_teams_channels": user_create,
    }
