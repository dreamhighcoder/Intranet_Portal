-- Migration: Fix admin exact match and display_order trigger to only exclude exact 'Administrator'
-- Date: 2025-09-01

-- 1) Ensure only exact 'Administrator' has NULL display_order
UPDATE positions
SET display_order = NULL
WHERE name = 'Administrator';

-- 2) Re-pack non-admin positions' display_order to be contiguous starting at 1
WITH non_admin AS (
  SELECT id
  FROM positions
  WHERE name <> 'Administrator' OR name IS NULL
),
ordered AS (
  SELECT p.id, ROW_NUMBER() OVER (ORDER BY p.display_order NULLS LAST, p.name) AS rn
  FROM positions p
  JOIN non_admin na ON na.id = p.id
)
UPDATE positions p
SET display_order = o.rn
FROM ordered o
WHERE p.id = o.id;

-- 3) Replace trigger function to skip only exact 'Administrator'
CREATE OR REPLACE FUNCTION positions_set_display_order()
RETURNS TRIGGER AS $$
DECLARE
  next_order integer;
BEGIN
  -- If this is the exact Administrator position, do not assign display_order
  IF NEW.name IS NOT NULL AND NEW.name = 'Administrator' THEN
    NEW.display_order = NULL;
    RETURN NEW;
  END IF;

  IF NEW.display_order IS NULL THEN
    SELECT COALESCE(MAX(display_order), 0) + 1 INTO next_order
    FROM positions
    WHERE name <> 'Administrator' OR name IS NULL;

    NEW.display_order = next_order;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4) Re-create trigger (idempotent)
DROP TRIGGER IF EXISTS trg_positions_set_display_order ON positions;
CREATE TRIGGER trg_positions_set_display_order
BEFORE INSERT ON positions
FOR EACH ROW
EXECUTE FUNCTION positions_set_display_order();