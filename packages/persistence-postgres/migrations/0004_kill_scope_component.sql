DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    WHERE t.typname = 'kill_scope'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'kill_scope'
      AND e.enumlabel = 'COMPONENT'
  ) THEN
    ALTER TYPE kill_scope ADD VALUE 'COMPONENT';
  END IF;
END
$$;
