CREATE OR REPLACE FUNCTION app_current_tenant_required()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  tenant TEXT;
BEGIN
  tenant := NULLIF(current_setting('app.tenant_id', TRUE), '');
  IF tenant IS NULL THEN
    RAISE EXCEPTION 'app.tenant_id must be set for tenant-scoped queries'
      USING ERRCODE = '42501';
  END IF;
  RETURN tenant;
END;
$$;

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE config_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE config_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE approvals_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE execution_traces ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE kill_switches ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_branding ENABLE ROW LEVEL SECURITY;
ALTER TABLE policy_bindings ENABLE ROW LEVEL SECURITY;

ALTER TABLE users FORCE ROW LEVEL SECURITY;
ALTER TABLE user_roles FORCE ROW LEVEL SECURITY;
ALTER TABLE config_packages FORCE ROW LEVEL SECURITY;
ALTER TABLE config_versions FORCE ROW LEVEL SECURITY;
ALTER TABLE approvals_reviews FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_events FORCE ROW LEVEL SECURITY;
ALTER TABLE execution_traces FORCE ROW LEVEL SECURITY;
ALTER TABLE feature_flags FORCE ROW LEVEL SECURITY;
ALTER TABLE kill_switches FORCE ROW LEVEL SECURITY;
ALTER TABLE tenant_branding FORCE ROW LEVEL SECURITY;
ALTER TABLE policy_bindings FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_required_users ON users;
CREATE POLICY tenant_required_users ON users
  AS RESTRICTIVE
  FOR ALL
  USING (tenant_id = app_current_tenant_required())
  WITH CHECK (tenant_id = app_current_tenant_required());

DROP POLICY IF EXISTS tenant_required_user_roles ON user_roles;
CREATE POLICY tenant_required_user_roles ON user_roles
  AS RESTRICTIVE
  FOR ALL
  USING (tenant_id = app_current_tenant_required())
  WITH CHECK (tenant_id = app_current_tenant_required());

DROP POLICY IF EXISTS tenant_required_config_packages ON config_packages;
CREATE POLICY tenant_required_config_packages ON config_packages
  AS RESTRICTIVE
  FOR ALL
  USING (tenant_id = app_current_tenant_required())
  WITH CHECK (tenant_id = app_current_tenant_required());

DROP POLICY IF EXISTS tenant_required_config_versions ON config_versions;
CREATE POLICY tenant_required_config_versions ON config_versions
  AS RESTRICTIVE
  FOR ALL
  USING (tenant_id = app_current_tenant_required())
  WITH CHECK (tenant_id = app_current_tenant_required());

DROP POLICY IF EXISTS tenant_required_approvals_reviews ON approvals_reviews;
CREATE POLICY tenant_required_approvals_reviews ON approvals_reviews
  AS RESTRICTIVE
  FOR ALL
  USING (tenant_id = app_current_tenant_required())
  WITH CHECK (tenant_id = app_current_tenant_required());

DROP POLICY IF EXISTS tenant_required_audit_events ON audit_events;
CREATE POLICY tenant_required_audit_events ON audit_events
  AS RESTRICTIVE
  FOR ALL
  USING (tenant_id = app_current_tenant_required())
  WITH CHECK (tenant_id = app_current_tenant_required());

DROP POLICY IF EXISTS tenant_required_execution_traces ON execution_traces;
CREATE POLICY tenant_required_execution_traces ON execution_traces
  AS RESTRICTIVE
  FOR ALL
  USING (tenant_id = app_current_tenant_required())
  WITH CHECK (tenant_id = app_current_tenant_required());

DROP POLICY IF EXISTS tenant_required_feature_flags ON feature_flags;
CREATE POLICY tenant_required_feature_flags ON feature_flags
  AS RESTRICTIVE
  FOR ALL
  USING (tenant_id = app_current_tenant_required())
  WITH CHECK (tenant_id = app_current_tenant_required());

DROP POLICY IF EXISTS tenant_required_kill_switches ON kill_switches;
CREATE POLICY tenant_required_kill_switches ON kill_switches
  AS RESTRICTIVE
  FOR ALL
  USING (tenant_id = app_current_tenant_required())
  WITH CHECK (tenant_id = app_current_tenant_required());

DROP POLICY IF EXISTS tenant_required_tenant_branding ON tenant_branding;
CREATE POLICY tenant_required_tenant_branding ON tenant_branding
  AS RESTRICTIVE
  FOR ALL
  USING (tenant_id = app_current_tenant_required())
  WITH CHECK (tenant_id = app_current_tenant_required());

DROP POLICY IF EXISTS tenant_required_policy_bindings ON policy_bindings;
CREATE POLICY tenant_required_policy_bindings ON policy_bindings
  AS RESTRICTIVE
  FOR ALL
  USING (tenant_id = app_current_tenant_required())
  WITH CHECK (tenant_id = app_current_tenant_required());

REVOKE ALL ON TABLE users, user_roles, config_packages, config_versions, approvals_reviews, audit_events, execution_traces, feature_flags, kill_switches, tenant_branding, policy_bindings FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC;
