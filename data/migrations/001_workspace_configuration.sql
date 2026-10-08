CREATE TABLE IF NOT EXISTS workspace_schema_version(version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE TABLE IF NOT EXISTS workspace_configuration(workspace_id text NOT NULL,kind text NOT NULL CHECK(kind IN ('ground_stations','scenario_drafts')),revision bigint NOT NULL CHECK(revision>0),value jsonb NOT NULL,updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(workspace_id,kind));
CREATE TABLE IF NOT EXISTS workspace_configuration_history(workspace_id text NOT NULL,kind text NOT NULL,revision bigint NOT NULL,value jsonb NOT NULL,saved_at timestamptz NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(workspace_id,kind,revision));
INSERT INTO workspace_schema_version(version) VALUES(1) ON CONFLICT DO NOTHING;
