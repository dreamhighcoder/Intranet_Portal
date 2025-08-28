-- Migration: Exclude administrator positions from display_order sequencing
-- Date: 2025-08-28

-- 1) Ensure admin positions have NULL display_order (not part of ordering)
UPDATE positions
SET display_order = NULL
WHERE (lower(name) LIKE '%administrator%' OR lower(name) LIKE '%admin%');

-- 2) Re-pack non-admin positions' display_order to be contiguous starting at 1
WITH non_admin AS (
  SELECT id
  FROM positions
  WHERE NOT (lower(name) LIKE '%administrator%' OR lower(name) LIKE '%admin%')
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

-- 3) Replace trigger function to skip admins and compute max among non-admin positions only
CREATE OR REPLACE FUNCTION positions_set_display_order()
RETURNS TRIGGER AS $$
DECLARE
  next_order integer;
BEGIN
  -- If this is an admin/administrator position, do not assign display_order
  IF NEW.name IS NOT NULL AND (lower(NEW.name) LIKE '%administrator%' OR lower(NEW.name) LIKE '%admin%') THEN
    NEW.display_order = NULL;
    RETURN NEW;
  END IF;

  IF NEW.display_order IS NULL THEN
    SELECT COALESCE(MAX(display_order), 0) + 1 INTO next_order
    FROM positions
    WHERE NOT (lower(name) LIKE '%administrator%' OR lower(name) LIKE '%admin%');

    NEW.display_order = next_order;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Re-create trigger (idempotent)
DROP TRIGGER IF EXISTS trg_positions_set_display_order ON positions;
CREATE TRIGGER trg_positions_set_display_order
BEFORE INSERT ON positions
FOR EACH ROW
EXECUTE FUNCTION positions_set_display_order();