-- Migration: Convert position_id to responsibility arrays
-- Date: 2024-12-19
-- Description: Migrates existing master_tasks from position_id to responsibility arrays
-- This ensures existing tasks work with the new filtering system

-- Function to convert position name to responsibility value
-- This matches the nameToResponsibilityValue function in position-utils.ts
CREATE OR REPLACE FUNCTION name_to_responsibility_value(position_name TEXT)
RETURNS TEXT AS $$
BEGIN
  IF position_name IS NULL OR position_name = 'Administrator' THEN
    RETURN NULL;
  END IF;
  
  RETURN LOWER(TRIM(
    REGEXP_REPLACE(
      REGEXP_REPLACE(position_name, '[()\/]', ' ', 'g'),
      '[^a-z0-9]+', '-', 'g'
    )
  ));
END;
$$ LANGUAGE plpgsql;

-- Update master_tasks to populate responsibility arrays from position_id
UPDATE master_tasks 
SET responsibility = ARRAY[name_to_responsibility_value(p.name)]
FROM positions p
WHERE master_tasks.position_id = p.id
  AND (master_tasks.responsibility IS NULL OR master_tasks.responsibility = '{}')
  AND p.name != 'Administrator';

-- Update master_tasks to populate categories if empty
UPDATE master_tasks 
SET categories = CASE 
  WHEN category IS NOT NULL AND category != '' THEN ARRAY[category]
  ELSE ARRAY['general-pharmacy-operations']
END
WHERE categories IS NULL OR categories = '{}';

-- Log the migration results
DO $$
DECLARE
  updated_count INTEGER;
  total_count INTEGER;
BEGIN
  -- Count updated tasks
  SELECT COUNT(*) INTO updated_count
  FROM master_tasks 
  WHERE responsibility IS NOT NULL AND responsibility != '{}';
  
  SELECT COUNT(*) INTO total_count
  FROM master_tasks;
  
  RAISE NOTICE 'Migration completed: % out of % tasks now have responsibility arrays', updated_count, total_count;
  
  -- Show sample of migrated data
  RAISE NOTICE 'Sample migrated tasks:';
  FOR rec IN 
    SELECT title, responsibility, categories 
    FROM master_tasks 
    WHERE responsibility IS NOT NULL AND responsibility != '{}'
    LIMIT 5
  LOOP
    RAISE NOTICE '  Task: % | Responsibility: % | Categories: %', rec.title, rec.responsibility, rec.categories;
  END LOOP;
END $$;

-- Clean up the helper function
DROP FUNCTION name_to_responsibility_value(TEXT);

-- Add comment for documentation
COMMENT ON COLUMN master_tasks.responsibility IS 'Array of responsibility values (migrated from position_id references)';
COMMENT ON COLUMN master_tasks.categories IS 'Array of category values (migrated from single category field)';