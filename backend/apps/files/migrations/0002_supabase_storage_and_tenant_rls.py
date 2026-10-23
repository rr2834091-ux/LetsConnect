# Generated for Supabase Multi-Tenant RLS & Storage Isolation

from django.db import migrations

FORWARD_SQL = """
-- 1. Enable Row Level Security on core multi-tenant tables
ALTER TABLE IF EXISTS tc_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS tc_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS tc_business_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS tc_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS tc_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS tc_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS tc_organization_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS tc_organization_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS tc_organization_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS tc_support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS lc_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS lc_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS lc_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS lc_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS lc_notifications ENABLE ROW LEVEL SECURITY;

-- 2. Create tenant isolation policies if not already present
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tc_organizations' AND policyname = 'tenant_isolation_tc_organizations') THEN
        CREATE POLICY tenant_isolation_tc_organizations ON tc_organizations FOR ALL TO authenticated, anon
        USING (id = NULLIF(current_setting('app.current_organization_id', true), '')::uuid OR (auth.jwt() ->> 'organization_id')::uuid = id OR current_user IN ('postgres', 'service_role'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tc_departments' AND policyname = 'tenant_isolation_tc_departments') THEN
        CREATE POLICY tenant_isolation_tc_departments ON tc_departments FOR ALL TO authenticated, anon
        USING (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::uuid OR (auth.jwt() ->> 'organization_id')::uuid = organization_id OR current_user IN ('postgres', 'service_role'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tc_business_roles' AND policyname = 'tenant_isolation_tc_business_roles') THEN
        CREATE POLICY tenant_isolation_tc_business_roles ON tc_business_roles FOR ALL TO authenticated, anon
        USING (organization_id IS NULL OR organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::uuid OR (auth.jwt() ->> 'organization_id')::uuid = organization_id OR current_user IN ('postgres', 'service_role'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tc_employees' AND policyname = 'tenant_isolation_tc_employees') THEN
        CREATE POLICY tenant_isolation_tc_employees ON tc_employees FOR ALL TO authenticated, anon
        USING (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::uuid OR (auth.jwt() ->> 'organization_id')::uuid = organization_id OR current_user IN ('postgres', 'service_role'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tc_teams' AND policyname = 'tenant_isolation_tc_teams') THEN
        CREATE POLICY tenant_isolation_tc_teams ON tc_teams FOR ALL TO authenticated, anon
        USING (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::uuid OR (auth.jwt() ->> 'organization_id')::uuid = organization_id OR current_user IN ('postgres', 'service_role'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tc_channels' AND policyname = 'tenant_isolation_tc_channels') THEN
        CREATE POLICY tenant_isolation_tc_channels ON tc_channels FOR ALL TO authenticated, anon
        USING (EXISTS (SELECT 1 FROM tc_teams WHERE tc_teams.id = tc_channels.team_id AND (tc_teams.organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::uuid OR (auth.jwt() ->> 'organization_id')::uuid = tc_teams.organization_id OR current_user IN ('postgres', 'service_role'))));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tc_organization_settings' AND policyname = 'tenant_isolation_tc_organization_settings') THEN
        CREATE POLICY tenant_isolation_tc_organization_settings ON tc_organization_settings FOR ALL TO authenticated, anon
        USING (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::uuid OR (auth.jwt() ->> 'organization_id')::uuid = organization_id OR current_user IN ('postgres', 'service_role'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tc_organization_policies' AND policyname = 'tenant_isolation_tc_organization_policies') THEN
        CREATE POLICY tenant_isolation_tc_organization_policies ON tc_organization_policies FOR ALL TO authenticated, anon
        USING (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::uuid OR (auth.jwt() ->> 'organization_id')::uuid = organization_id OR current_user IN ('postgres', 'service_role'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'lc_conversations' AND policyname = 'tenant_isolation_lc_conversations') THEN
        CREATE POLICY tenant_isolation_lc_conversations ON lc_conversations FOR ALL TO authenticated, anon
        USING (organization_id IS NULL OR organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::uuid OR (auth.jwt() ->> 'organization_id')::uuid = organization_id OR current_user IN ('postgres', 'service_role'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'lc_messages' AND policyname = 'tenant_isolation_lc_messages') THEN
        CREATE POLICY tenant_isolation_lc_messages ON lc_messages FOR ALL TO authenticated, anon
        USING (EXISTS (SELECT 1 FROM lc_conversations WHERE lc_conversations.id = lc_messages.conversation_id AND (lc_conversations.organization_id IS NULL OR lc_conversations.organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::uuid OR (auth.jwt() ->> 'organization_id')::uuid = lc_conversations.organization_id OR current_user IN ('postgres', 'service_role'))));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'lc_meetings' AND policyname = 'tenant_isolation_lc_meetings') THEN
        CREATE POLICY tenant_isolation_lc_meetings ON lc_meetings FOR ALL TO authenticated, anon
        USING (organization_id IS NULL OR organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::uuid OR (auth.jwt() ->> 'organization_id')::uuid = organization_id OR current_user IN ('postgres', 'service_role'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'lc_files' AND policyname = 'tenant_isolation_lc_files') THEN
        CREATE POLICY tenant_isolation_lc_files ON lc_files FOR ALL TO authenticated, anon
        USING (organization_id IS NULL OR organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::uuid OR (auth.jwt() ->> 'organization_id')::uuid = organization_id OR current_user IN ('postgres', 'service_role'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'lc_notifications' AND policyname = 'tenant_isolation_lc_notifications') THEN
        CREATE POLICY tenant_isolation_lc_notifications ON lc_notifications FOR ALL TO authenticated, anon
        USING (organization_id IS NULL OR organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::uuid OR (auth.jwt() ->> 'organization_id')::uuid = organization_id OR current_user IN ('postgres', 'service_role'));
    END IF;

    -- 3. Storage Policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'buckets' AND policyname = 'allow_select_buckets') THEN
        CREATE POLICY allow_select_buckets ON storage.buckets FOR SELECT TO anon, authenticated USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'allow_manage_objects') THEN
        CREATE POLICY allow_manage_objects ON storage.objects FOR ALL TO anon, authenticated USING (bucket_id = 'file_storage') WITH CHECK (bucket_id = 'file_storage');
    END IF;
END $$;
"""

BACKWARD_SQL = """
DROP POLICY IF EXISTS tenant_isolation_tc_organizations ON tc_organizations;
DROP POLICY IF EXISTS tenant_isolation_tc_departments ON tc_departments;
DROP POLICY IF EXISTS tenant_isolation_tc_business_roles ON tc_business_roles;
DROP POLICY IF EXISTS tenant_isolation_tc_employees ON tc_employees;
DROP POLICY IF EXISTS tenant_isolation_tc_teams ON tc_teams;
DROP POLICY IF EXISTS tenant_isolation_tc_channels ON tc_channels;
DROP POLICY IF EXISTS tenant_isolation_tc_organization_settings ON tc_organization_settings;
DROP POLICY IF EXISTS tenant_isolation_tc_organization_policies ON tc_organization_policies;
DROP POLICY IF EXISTS tenant_isolation_lc_conversations ON lc_conversations;
DROP POLICY IF EXISTS tenant_isolation_lc_messages ON lc_messages;
DROP POLICY IF EXISTS tenant_isolation_lc_meetings ON lc_meetings;
DROP POLICY IF EXISTS tenant_isolation_lc_files ON lc_files;
DROP POLICY IF EXISTS tenant_isolation_lc_notifications ON lc_notifications;
"""

def apply_rls(apps, schema_editor):
    if schema_editor.connection.vendor != 'postgresql':
        return
    schema_editor.execute(FORWARD_SQL)

def revert_rls(apps, schema_editor):
    if schema_editor.connection.vendor != 'postgresql':
        return
    schema_editor.execute(BACKWARD_SQL)

class Migration(migrations.Migration):

    dependencies = [
        ("lc_files", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(apply_rls, reverse_code=revert_rls),
    ]
