-- Migration: Add display_order to positions and enforce desired ordering
-- Date: 2025-08-28

-- 1) Add column if missing
ALTER TABLE positions
ADD COLUMN IF NOT EXISTS display_order integer;

-- 2) Backfill the requested order for known positions
--    Order:
--    1. Pharmacy Assistant
--    2. Dispensary Technician
--    3. DAA Packer
--    4. Pharmacist (Primary)
--    5. Pharmacist (Supporting)
--    6. Operational/Managerial
WITH updates AS (
  SELECT id, name,
    CASE
      WHEN lower(name) = 'pharmacy assistant' THEN 1
      WHEN lower(name) = 'dispensary technician' THEN 2
      WHEN lower(name) LIKE 'daa packer%' OR lower(name) = 'daa packer' THEN 3
      WHEN lower(name) IN ('pharmacist (primary)', 'pharmacist primary') THEN 4
      WHEN lower(name) IN ('pharmacist (supporting)', 'pharmacist supporting') THEN 5
      WHEN lower(name) IN ('operational/managerial') THEN 6
      ELSE NULL
    END AS ord
  FROM positions
)
UPDATE positions p
SET display_order = u.ord
FROM updates u
WHERE p.id = u.id AND u.ord IS NOT NULL;

-- 3) Assign remaining positions to max+row_number (by name) so all rows have display_order
WITH maxo AS (SELECT COALESCE(MAX(display_order), 0) AS m FROM positions),
ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY name) AS rn
  FROM positions
  WHERE display_order IS NULL
)
UPDATE positions p
SET display_order = (SELECT m FROM maxo) + o.rn
FROM ordered o
WHERE p.id = o.id;

-- 4) Enforce NOT NULL once backfilled
ALTER TABLE positions
ALTER COLUMN display_order SET NOT NULL;

-- 5) Index for faster ordering
CREATE INDEX IF NOT EXISTS idx_positions_display_order
ON positions(display_order);

-- 6) Trigger to auto-assign next order (last+1) on insert when not provided
CREATE OR REPLACE FUNCTION positions_set_display_order()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.display_order IS NULL THEN
    SELECT COALESCE(MAX(display_order), 0) + 1 INTO NEW.display_order FROM positions;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_positions_set_display_order ON positions;
CREATE TRIGGER trg_positions_set_display_order
BEFORE INSERT ON positions
FOR EACH ROW
EXECUTE FUNCTION positions_set_display_order();