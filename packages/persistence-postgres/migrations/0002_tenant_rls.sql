CREATE OR REPLACE FUNCTION app_current_tenant()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.tenant_id', TRUE), '');
$$;

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
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

ALTER TABLE tenants FORCE ROW LEVEL SECURITY;
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

DROP POLICY IF EXISTS tenant_isolation_tenants ON tenants;
CREATE POLICY tenant_isolation_tenants ON tenants
  USING (id = app_current_tenant())
  WITH CHECK (id = app_current_tenant());

DROP POLICY IF EXISTS tenant_isolation_users ON users;
CREATE POLICY tenant_isolation_users ON users
  USING (tenant_id = app_current_tenant())
  WITH CHECK (tenant_id = app_current_tenant());

DROP POLICY IF EXISTS tenant_isolation_user_roles ON user_roles;
CREATE POLICY tenant_isolation_user_roles ON user_roles
  USING (tenant_id = app_current_tenant())
  WITH CHECK (tenant_id = app_current_tenant());

DROP POLICY IF EXISTS tenant_isolation_config_packages ON config_packages;
CREATE POLICY tenant_isolation_config_packages ON config_packages
  USING (tenant_id = app_current_tenant())
  WITH CHECK (tenant_id = app_current_tenant());

DROP POLICY IF EXISTS tenant_isolation_config_versions ON config_versions;
CREATE POLICY tenant_isolation_config_versions ON config_versions
  USING (tenant_id = app_current_tenant())
  WITH CHECK (tenant_id = app_current_tenant());

DROP POLICY IF EXISTS tenant_isolation_approvals_reviews ON approvals_reviews;
CREATE POLICY tenant_isolation_approvals_reviews ON approvals_reviews
  USING (tenant_id = app_current_tenant())
  WITH CHECK (tenant_id = app_current_tenant());

DROP POLICY IF EXISTS tenant_isolation_audit_events ON audit_events;
CREATE POLICY tenant_isolation_audit_events ON audit_events
  USING (tenant_id = app_current_tenant())
  WITH CHECK (tenant_id = app_current_tenant());

DROP POLICY IF EXISTS tenant_isolation_execution_traces ON execution_traces;
CREATE POLICY tenant_isolation_execution_traces ON execution_traces
  USING (tenant_id = app_current_tenant())
  WITH CHECK (tenant_id = app_current_tenant());

DROP POLICY IF EXISTS tenant_isolation_feature_flags ON feature_flags;
CREATE POLICY tenant_isolation_feature_flags ON feature_flags
  USING (tenant_id = app_current_tenant())
  WITH CHECK (tenant_id = app_current_tenant());

DROP POLICY IF EXISTS tenant_isolation_kill_switches ON kill_switches;
CREATE POLICY tenant_isolation_kill_switches ON kill_switches
  USING (tenant_id = app_current_tenant())
  WITH CHECK (tenant_id = app_current_tenant());

DROP POLICY IF EXISTS tenant_isolation_tenant_branding ON tenant_branding;
CREATE POLICY tenant_isolation_tenant_branding ON tenant_branding
  USING (tenant_id = app_current_tenant())
  WITH CHECK (tenant_id = app_current_tenant());

DROP POLICY IF EXISTS tenant_isolation_policy_bindings ON policy_bindings;
CREATE POLICY tenant_isolation_policy_bindings ON policy_bindings
  USING (tenant_id = app_current_tenant())
  WITH CHECK (tenant_id = app_current_tenant());
