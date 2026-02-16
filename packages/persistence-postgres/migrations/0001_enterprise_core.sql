CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  CREATE TYPE config_version_status AS ENUM ('DRAFT', 'REVIEW', 'APPROVED', 'ACTIVE', 'DEPRECATED', 'RETIRED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE approval_status AS ENUM ('PENDING', 'APPROVED', 'CHANGES_REQUESTED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE audit_severity AS ENUM ('info', 'warning', 'error');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE kill_scope AS ENUM ('TENANT', 'RULESET', 'VERSION');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  checksum TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, email)
);

CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  description TEXT NOT NULL
);

INSERT INTO roles (id, description)
VALUES
  ('Author', 'Can create and edit draft versions'),
  ('Approver', 'Can approve/reject review requests'),
  ('Publisher', 'Can promote and rollback active versions'),
  ('Viewer', 'Read-only access')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS user_roles (
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  role_id TEXT NOT NULL REFERENCES roles(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_by TEXT,
  PRIMARY KEY (tenant_id, user_id, role_id),
  FOREIGN KEY (tenant_id, user_id) REFERENCES users(tenant_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS config_packages (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  config_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT,
  updated_at TIMESTAMPTZ,
  UNIQUE (tenant_id, config_id)
);

CREATE TABLE IF NOT EXISTS config_versions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  package_id TEXT NOT NULL REFERENCES config_packages(id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  status config_version_status NOT NULL DEFAULT 'DRAFT',
  bundle JSONB NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT,
  updated_at TIMESTAMPTZ,
  is_killed BOOLEAN NOT NULL DEFAULT FALSE,
  kill_reason TEXT,
  execution_traces_uri TEXT,
  UNIQUE (tenant_id, package_id, version)
);

CREATE TABLE IF NOT EXISTS approvals_reviews (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  package_id TEXT NOT NULL REFERENCES config_packages(id) ON DELETE CASCADE,
  version_id TEXT NOT NULL REFERENCES config_versions(id) ON DELETE CASCADE,
  requested_by TEXT NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  scope TEXT NOT NULL,
  risk TEXT NOT NULL,
  status approval_status NOT NULL DEFAULT 'PENDING',
  decided_by TEXT,
  decided_at TIMESTAMPTZ,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT NOT NULL,
  severity audit_severity NOT NULL DEFAULT 'info',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS execution_traces (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  execution_id TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  package_id TEXT REFERENCES config_packages(id) ON DELETE SET NULL,
  version_id TEXT REFERENCES config_versions(id) ON DELETE SET NULL,
  trace JSONB NOT NULL,
  cold_storage_uri TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS execution_trace_unique_execution_id
  ON execution_traces (tenant_id, execution_id);

CREATE TABLE IF NOT EXISTS feature_flags (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  env TEXT NOT NULL,
  flag_key TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, env, flag_key)
);

CREATE TABLE IF NOT EXISTS kill_switches (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  scope kill_scope NOT NULL,
  package_id TEXT REFERENCES config_packages(id) ON DELETE CASCADE,
  version_id TEXT REFERENCES config_versions(id) ON DELETE CASCADE,
  ruleset_key TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  reason TEXT,
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenant_branding (
  tenant_id TEXT PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  logo_url TEXT,
  mode TEXT NOT NULL DEFAULT 'light',
  primary_color TEXT NOT NULL DEFAULT '#0055aa',
  secondary_color TEXT NOT NULL DEFAULT '#0b2a44',
  typography_scale NUMERIC(4,2) NOT NULL DEFAULT 1.0,
  radius INTEGER NOT NULL DEFAULT 8,
  spacing INTEGER NOT NULL DEFAULT 8,
  css_variables JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS policy_bindings (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  policy_key TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, policy_key)
);

CREATE INDEX IF NOT EXISTS idx_config_packages_tenant ON config_packages (tenant_id);
CREATE INDEX IF NOT EXISTS idx_config_versions_tenant ON config_versions (tenant_id, package_id, status);
CREATE INDEX IF NOT EXISTS idx_approvals_reviews_tenant ON approvals_reviews (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_audit_events_tenant ON audit_events (tenant_id, at DESC);
CREATE INDEX IF NOT EXISTS idx_feature_flags_tenant ON feature_flags (tenant_id, env);
CREATE INDEX IF NOT EXISTS idx_kill_switches_tenant ON kill_switches (tenant_id, scope, active);
