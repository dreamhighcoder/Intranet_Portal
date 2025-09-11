-- =====================================================
-- PHARMACY INTRANET PORTAL - DATABASE SETUP SCRIPT
-- =====================================================
-- Run this script in your Supabase SQL Editor to set up the complete database schema
-- This will fix the system settings save functionality

-- 1. Create system_settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timezone TEXT NOT NULL DEFAULT 'Australia/Sydney',
  new_since_hour TIME NOT NULL DEFAULT '00:00:00',
  missed_cutoff_time TIME NOT NULL DEFAULT '23:59:00',
  auto_logout_enabled BOOLEAN NOT NULL DEFAULT true,
  auto_logout_delay_minutes INTEGER NOT NULL DEFAULT 5,
  task_generation_days_ahead INTEGER NOT NULL DEFAULT 999999,
  task_generation_days_behind INTEGER NOT NULL DEFAULT 0,
  working_days TEXT[] NOT NULL DEFAULT ARRAY['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
  public_holiday_push_forward BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT,
  updated_by TEXT,
  
  -- Constraints
  CONSTRAINT valid_timezone CHECK (timezone IS NOT NULL AND length(timezone) > 0),
  CONSTRAINT valid_new_since_hour CHECK (new_since_hour IS NOT NULL),
  CONSTRAINT valid_missed_cutoff_time CHECK (missed_cutoff_time IS NOT NULL),
  CONSTRAINT valid_logout_delay CHECK (auto_logout_delay_minutes >= 1 AND auto_logout_delay_minutes <= 60),
  CONSTRAINT valid_task_generation_ahead CHECK (task_generation_days_ahead >= 1 AND task_generation_days_ahead <= 3650),
  CONSTRAINT valid_task_generation_behind CHECK (task_generation_days_behind >= 0 AND task_generation_days_behind <= 365),
  CONSTRAINT valid_working_days CHECK (array_length(working_days, 1) >= 1)
);

-- 2. Add missing columns if they don't exist (for existing tables)
DO $$ 
BEGIN
  -- Check and add timezone column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'system_settings' AND column_name = 'timezone') THEN
    ALTER TABLE system_settings ADD COLUMN timezone TEXT NOT NULL DEFAULT 'Australia/Sydney';
  END IF;
  
  -- Check and add new_since_hour column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'system_settings' AND column_name = 'new_since_hour') THEN
    ALTER TABLE system_settings ADD COLUMN new_since_hour TIME NOT NULL DEFAULT '00:00:00';
  END IF;
  
  -- Check and add missed_cutoff_time column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'system_settings' AND column_name = 'missed_cutoff_time') THEN
    ALTER TABLE system_settings ADD COLUMN missed_cutoff_time TIME NOT NULL DEFAULT '23:59:00';
  END IF;
  
  -- Check and add auto_logout_enabled column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'system_settings' AND column_name = 'auto_logout_enabled') THEN
    ALTER TABLE system_settings ADD COLUMN auto_logout_enabled BOOLEAN NOT NULL DEFAULT true;
  END IF;
  
  -- Check and add auto_logout_delay_minutes column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'system_settings' AND column_name = 'auto_logout_delay_minutes') THEN
    ALTER TABLE system_settings ADD COLUMN auto_logout_delay_minutes INTEGER NOT NULL DEFAULT 5;
  END IF;
  
  -- Check and add task_generation_days_ahead column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'system_settings' AND column_name = 'task_generation_days_ahead') THEN
    ALTER TABLE system_settings ADD COLUMN task_generation_days_ahead INTEGER NOT NULL DEFAULT 999999;
  END IF;
  
  -- Check and add task_generation_days_behind column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'system_settings' AND column_name = 'task_generation_days_behind') THEN
    ALTER TABLE system_settings ADD COLUMN task_generation_days_behind INTEGER NOT NULL DEFAULT 0;
  END IF;
  
  -- Check and add working_days column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'system_settings' AND column_name = 'working_days') THEN
    ALTER TABLE system_settings ADD COLUMN working_days TEXT[] NOT NULL DEFAULT ARRAY['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  END IF;
  
  -- Check and add public_holiday_push_forward column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'system_settings' AND column_name = 'public_holiday_push_forward') THEN
    ALTER TABLE system_settings ADD COLUMN public_holiday_push_forward BOOLEAN NOT NULL DEFAULT true;
  END IF;
  
  -- Check and add created_at column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'system_settings' AND column_name = 'created_at') THEN
    ALTER TABLE system_settings ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;
  
  -- Check and add updated_at column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'system_settings' AND column_name = 'updated_at') THEN
    ALTER TABLE system_settings ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;
  
  -- Check and add created_by column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'system_settings' AND column_name = 'created_by') THEN
    ALTER TABLE system_settings ADD COLUMN created_by TEXT;
  END IF;
  
  -- Check and add updated_by column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'system_settings' AND column_name = 'updated_by') THEN
    ALTER TABLE system_settings ADD COLUMN updated_by TEXT;
  END IF;
END $$;

-- 3. Insert default settings if none exist
INSERT INTO system_settings (
  timezone,
  new_since_hour,
  missed_cutoff_time,
  auto_logout_enabled,
  auto_logout_delay_minutes,
  task_generation_days_ahead,
  task_generation_days_behind,
  working_days,
  public_holiday_push_forward,
  created_at,
  updated_at
)
SELECT 
  'Australia/Sydney',
  '09:00:00',
  '23:59:00',
  true,
  5,
  999999,
  0,
  ARRAY['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
  true,
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM system_settings);

-- 4. Create or replace the update trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop trigger if it exists and recreate it
DROP TRIGGER IF EXISTS update_system_settings_updated_at ON system_settings;
CREATE TRIGGER update_system_settings_updated_at
  BEFORE UPDATE ON system_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 5. Set up Row Level Security (RLS)
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow authenticated users to read system settings" ON system_settings;
DROP POLICY IF EXISTS "Allow admin users to update system settings" ON system_settings;

-- Create policies for system_settings
CREATE POLICY "Allow authenticated users to read system settings"
  ON system_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow admin users to update system settings"
  ON system_settings FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 6. Grant necessary permissions
GRANT ALL ON system_settings TO authenticated;
GRANT ALL ON system_settings TO service_role;

-- 7. Refresh the PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- 8. Verify the setup
SELECT 'Setup completed successfully!' as status;
SELECT 'Current system_settings:' as info;
SELECT * FROM system_settings;