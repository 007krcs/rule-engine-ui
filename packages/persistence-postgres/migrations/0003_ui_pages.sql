-- Keep UI pages embedded in config_versions.bundle JSONB.
-- Rationale: preserves existing read/write paths and avoids introducing a join table
-- for this phase, while still enabling multiple pages per version.

CREATE OR REPLACE FUNCTION app_normalize_ui_pages_bundle(input_bundle JSONB)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  bundle JSONB := COALESCE(input_bundle, '{}'::JSONB);
  ui_schema JSONB;
  ui_schemas JSONB;
  active_page_id TEXT;
  flow_page_id TEXT;
  first_page_id TEXT;
BEGIN
  ui_schema := bundle->'uiSchema';
  ui_schemas := bundle->'uiSchemasById';

  IF jsonb_typeof(ui_schemas) <> 'object' OR jsonb_object_length(ui_schemas) = 0 THEN
    IF jsonb_typeof(ui_schema) = 'object' THEN
      active_page_id := NULLIF(ui_schema->>'pageId', '');
      IF active_page_id IS NULL THEN
        active_page_id := 'builder-preview';
        ui_schema := jsonb_set(ui_schema, '{pageId}', to_jsonb(active_page_id), TRUE);
      END IF;
      ui_schemas := jsonb_build_object(active_page_id, ui_schema);
    ELSE
      ui_schemas := '{}'::JSONB;
    END IF;
  END IF;

  active_page_id := NULLIF(bundle->>'activeUiPageId', '');

  flow_page_id := NULL;
  IF jsonb_typeof(bundle->'flowSchema') = 'object' THEN
    flow_page_id := NULLIF(
      bundle #>> ARRAY['flowSchema', 'states', COALESCE(bundle #>> '{flowSchema,initialState}', ''), 'uiPageId'],
      ''
    );
  END IF;

  IF active_page_id IS NULL OR NOT (ui_schemas ? active_page_id) THEN
    IF flow_page_id IS NOT NULL AND ui_schemas ? flow_page_id THEN
      active_page_id := flow_page_id;
    END IF;
  END IF;

  IF active_page_id IS NULL OR NOT (ui_schemas ? active_page_id) THEN
    SELECT key INTO first_page_id
    FROM jsonb_each(ui_schemas)
    ORDER BY key
    LIMIT 1;
    active_page_id := COALESCE(first_page_id, 'builder-preview');
  END IF;

  ui_schema := ui_schemas->active_page_id;

  bundle := jsonb_set(bundle, '{uiSchemasById}', ui_schemas, TRUE);
  bundle := jsonb_set(bundle, '{activeUiPageId}', to_jsonb(active_page_id), TRUE);
  IF ui_schema IS NOT NULL THEN
    bundle := jsonb_set(bundle, '{uiSchema}', ui_schema, TRUE);
  END IF;

  RETURN bundle;
END;
$$;

UPDATE config_versions
SET bundle = app_normalize_ui_pages_bundle(bundle);

DROP FUNCTION app_normalize_ui_pages_bundle(JSONB);
