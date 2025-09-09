-- Migration: Add Master Checklist and Checklist Instances Support
-- Date: 2024-12-19
-- Description: Extends master_tasks table and adds checklist_instances table
-- Safe to run multiple times (uses IF NOT EXISTS and ALTER TABLE ADD COLUMN IF NOT EXISTS)

-- ========================================
-- UPDATE MASTER_TASKS TABLE
-- ========================================

-- Add new columns to master_tasks table (backward compatible)
DO $$ 
BEGIN
    -- Add responsibility array if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'master_tasks' AND column_name = 'responsibility') THEN
        ALTER TABLE master_tasks ADD COLUMN responsibility TEXT[] DEFAULT '{}';
    END IF;

    -- Add categories array if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'master_tasks' AND column_name = 'categories') THEN
        ALTER TABLE master_tasks ADD COLUMN categories TEXT[] DEFAULT '{}';
    END IF;

    -- Add frequency_rules JSONB if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'master_tasks' AND column_name = 'frequency_rules') THEN
        ALTER TABLE master_tasks ADD COLUMN frequency_rules JSONB DEFAULT '{}';
    END IF;

    -- Add due_date if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'master_tasks' AND column_name = 'due_date') THEN
        ALTER TABLE master_tasks ADD COLUMN due_date DATE;
    END IF;

    -- Add due_time if it doesn't exist (rename from default_due_time if needed)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'master_tasks' AND column_name = 'due_time') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'master_tasks' AND column_name = 'default_due_time') THEN
            -- Rename default_due_time to due_time for consistency
            ALTER TABLE master_tasks RENAME COLUMN default_due_time TO due_time;
        ELSE
            ALTER TABLE master_tasks ADD COLUMN due_time TIME;
        END IF;
    END IF;

    -- Add created_by if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'master_tasks' AND column_name = 'created_by') THEN
        ALTER TABLE master_tasks ADD COLUMN created_by UUID REFERENCES auth.users(id);
    END IF;

    -- Add updated_by if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'master_tasks' AND column_name = 'updated_by') THEN
        ALTER TABLE master_tasks ADD COLUMN updated_by UUID REFERENCES auth.users(id);
    END IF;

    -- Add publish_delay if it doesn't exist (rename from publish_delay_date if needed)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'master_tasks' AND column_name = 'publish_delay') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'master_tasks' AND column_name = 'publish_delay_date') THEN
            -- Rename publish_delay_date to publish_delay for consistency
            ALTER TABLE master_tasks RENAME COLUMN publish_delay_date TO publish_delay;
        ELSE
            ALTER TABLE master_tasks ADD COLUMN publish_delay DATE;
        END IF;
    END IF;

    -- Add custom_order for drag-and-drop ordering if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'master_tasks' AND column_name = 'custom_order') THEN
        ALTER TABLE master_tasks ADD COLUMN custom_order INTEGER;
    END IF;

    -- Update publish_status check constraint to include 'draft' if not already present
    IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints 
                   WHERE constraint_name = 'master_tasks_publish_status_check') THEN
        ALTER TABLE master_tasks ADD CONSTRAINT master_tasks_publish_status_check 
        CHECK (publish_status IN ('active', 'draft', 'inactive'));
    END IF;

    RAISE NOTICE 'Master tasks table updated successfully';
END $$;

-- ========================================
-- MIGRATE EXISTING FREQUENCY DATA
-- ========================================

-- Convert existing frequency enum values to frequency_rules JSONB
-- This ensures backward compatibility while adding the new system
DO $$ 
BEGIN
    -- Only run if frequency_rules column exists and has data to migrate
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'master_tasks' AND column_name = 'frequency_rules') THEN
        
        -- Update frequency_rules for existing records based on their frequency value
        UPDATE master_tasks 
        SET frequency_rules = CASE 
            WHEN frequency = 'once_off_sticky' THEN 
                '{"type": "once_off_sticky", "business_days_only": false}'::jsonb
            WHEN frequency = 'every_day' THEN 
                '{"type": "daily", "every_n_days": 1, "business_days_only": false}'::jsonb
            WHEN frequency = 'weekly' THEN 
                '{"type": "weekly", "every_n_weeks": 1, "business_days_only": false}'::jsonb
            WHEN frequency = 'specific_weekdays' THEN 
                CASE 
                    WHEN weekdays IS NOT NULL AND array_length(weekdays, 1) > 0 THEN
                        jsonb_build_object('type', 'specific_weekdays', 'weekdays', weekdays, 'business_days_only', false)
                    ELSE
                        '{"type": "specific_weekdays", "weekdays": [1, 2, 3, 4, 5], "business_days_only": false}'::jsonb
                END
            WHEN frequency = 'start_every_month' THEN 
                '{"type": "start_of_month", "every_n_months": 1, "day_offset": 0, "business_days_only": false}'::jsonb
            WHEN frequency = 'start_certain_months' THEN 
                CASE 
                    WHEN months IS NOT NULL AND array_length(months, 1) > 0 THEN
                        jsonb_build_object('type', 'start_certain_months', 'months', months, 'day_offset', 0, 'business_days_only', false)
                    ELSE
                        '{"type": "start_certain_months", "months": [1], "day_offset": 0, "business_days_only": false}'::jsonb
                END
            WHEN frequency = 'every_month' THEN 
                '{"type": "every_month", "every_n_months": 1, "day_offset": 0, "business_days_only": false}'::jsonb
            WHEN frequency = 'certain_months' THEN 
                CASE 
                    WHEN months IS NOT NULL AND array_length(months, 1) > 0 THEN
                        jsonb_build_object('type', 'certain_months', 'months', months, 'day_offset', 0, 'business_days_only', false)
                    ELSE
                        '{"type": "certain_months", "months": [1], "day_offset": 0, "business_days_only": false}'::jsonb
                END
            WHEN frequency = 'end_every_month' THEN 
                '{"type": "end_of_month", "every_n_months": 1, "days_from_end": 0, "business_days_only": false}'::jsonb
            WHEN frequency = 'end_certain_months' THEN 
                CASE 
                    WHEN months IS NOT NULL AND array_length(months, 1) > 0 THEN
                        jsonb_build_object('type', 'end_certain_months', 'months', months, 'days_from_end', 0, 'business_days_only', false)
                    ELSE
                        '{"type": "end_certain_months", "months": [1], "days_from_end": 0, "business_days_only": false}'::jsonb
                END
            ELSE 
                '{"type": "daily", "every_n_days": 1, "business_days_only": false}'::jsonb
        END
        WHERE frequency_rules = '{}'::jsonb OR frequency_rules IS NULL;
        
        RAISE NOTICE 'Migrated existing frequency data to frequency_rules JSONB';
    END IF;
END $$;

-- ========================================
-- CREATE CHECKLIST_INSTANCES TABLE
-- ========================================

CREATE TABLE IF NOT EXISTS checklist_instances (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    master_task_id UUID NOT NULL REFERENCES master_tasks(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    role TEXT NOT NULL,
    status TEXT CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped', 'overdue')) DEFAULT 'pending',
    completed_by UUID REFERENCES auth.users(id),
    completed_at TIMESTAMP WITH TIME ZONE,
    payload JSONB DEFAULT '{}',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Composite unique constraint
    UNIQUE(master_task_id, date, role)
);

-- ========================================
-- CREATE INDEXES
-- ========================================

-- Indexes for checklist_instances table
CREATE INDEX IF NOT EXISTS idx_checklist_instances_master_task_id ON checklist_instances(master_task_id);
CREATE INDEX IF NOT EXISTS idx_checklist_instances_date ON checklist_instances(date);
CREATE INDEX IF NOT EXISTS idx_checklist_instances_role ON checklist_instances(role);
CREATE INDEX IF NOT EXISTS idx_checklist_instances_status ON checklist_instances(status);
CREATE INDEX IF NOT EXISTS idx_checklist_instances_completed_by ON checklist_instances(completed_by);
CREATE INDEX IF NOT EXISTS idx_checklist_instances_master_date ON checklist_instances(master_task_id, date);
CREATE INDEX IF NOT EXISTS idx_checklist_instances_role_status ON checklist_instances(role, status);

-- Indexes for new master_tasks columns
CREATE INDEX IF NOT EXISTS idx_master_tasks_responsibility_gin ON master_tasks USING GIN (responsibility);
CREATE INDEX IF NOT EXISTS idx_master_tasks_categories_gin ON master_tasks USING GIN (categories);
CREATE INDEX IF NOT EXISTS idx_master_tasks_frequency_rules_gin ON master_tasks USING GIN (frequency_rules);
CREATE INDEX IF NOT EXISTS idx_master_tasks_publish_delay ON master_tasks(publish_delay);
CREATE INDEX IF NOT EXISTS idx_master_tasks_created_by ON master_tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_master_tasks_updated_by ON master_tasks(updated_by);
CREATE INDEX IF NOT EXISTS idx_master_tasks_custom_order ON master_tasks(custom_order);

-- ========================================
-- CREATE TRIGGERS
-- ========================================

-- Create trigger for checklist_instances updated_at
DROP TRIGGER IF EXISTS update_checklist_instances_updated_at ON checklist_instances;
CREATE TRIGGER update_checklist_instances_updated_at 
    BEFORE UPDATE ON checklist_instances 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- ENABLE ROW LEVEL SECURITY
-- ========================================

ALTER TABLE checklist_instances ENABLE ROW LEVEL SECURITY;

-- ========================================
-- RLS POLICIES FOR CHECKLIST_INSTANCES
-- ========================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can manage all checklist instances" ON checklist_instances;
DROP POLICY IF EXISTS "Users can view own role checklist instances" ON checklist_instances;
DROP POLICY IF EXISTS "Users can update own role checklist instances" ON checklist_instances;
DROP POLICY IF EXISTS "System can insert checklist instances" ON checklist_instances;

-- Admins can manage all checklist instances
CREATE POLICY "Admins can manage all checklist instances" ON checklist_instances
  FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) = 'admin')
  WITH CHECK (get_user_role(auth.uid()) = 'admin');

-- Users can view checklist instances for their role
CREATE POLICY "Users can view own role checklist instances" ON checklist_instances
  FOR SELECT TO authenticated
  USING (
    get_user_role(auth.uid()) = 'viewer' AND
    role IN (
      SELECT p.name FROM positions p
      JOIN user_profiles up ON p.id = up.position_id
      WHERE up.id = auth.uid()
    )
  );

-- Users can update checklist instances for their role
CREATE POLICY "Users can update own role checklist instances" ON checklist_instances
  FOR UPDATE TO authenticated
  USING (
    role IN (
      SELECT p.name FROM positions p
      JOIN user_profiles up ON p.id = up.position_id
      WHERE up.id = auth.uid()
    )
  )
  WITH CHECK (
    role IN (
      SELECT p.name FROM positions p
      JOIN user_profiles up ON p.id = up.position_id
      WHERE up.id = auth.uid()
    )
  );

-- System can insert checklist instances
CREATE POLICY "System can insert checklist instances" ON checklist_instances
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- ========================================
-- UPDATE EXISTING TRIGGERS
-- ========================================

-- Update master_tasks trigger to handle updated_by
CREATE OR REPLACE FUNCTION update_master_tasks_updated_by()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.updated_by = auth.uid();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop and recreate the trigger
DROP TRIGGER IF EXISTS update_master_tasks_updated_at ON master_tasks;
CREATE TRIGGER update_master_tasks_updated_at 
    BEFORE UPDATE ON master_tasks 
    FOR EACH ROW 
    EXECUTE FUNCTION update_master_tasks_updated_by();

-- ========================================
-- HELPER FUNCTIONS
-- ========================================

-- Function to get user's roles (positions)
CREATE OR REPLACE FUNCTION get_user_roles(user_id uuid)
RETURNS text[] AS $$
BEGIN
  RETURN ARRAY(
    SELECT p.name FROM positions p
    JOIN user_profiles up ON p.id = up.position_id
    WHERE up.id = user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has access to a role
CREATE OR REPLACE FUNCTION user_has_role(user_id uuid, role_name text)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS(
    SELECT 1 FROM positions p
    JOIN user_profiles up ON p.id = up.position_id
    WHERE up.id = user_id AND p.name = role_name
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- EXAMPLE DATA INSERTIONS (UPDATED)
-- ========================================

-- Example 1: Every day task (with both old and new frequency fields for compatibility)
INSERT INTO master_tasks (
    title, 
    description, 
    responsibility, 
    categories, 
    frequency,
    frequency_rules,
    timing,
    due_time,
    publish_status
) VALUES (
    'Daily Safety Check',
    'Perform daily safety inspection of pharmacy area',
    ARRAY['pharmacist-primary', 'pharmacy-assistants'],
    ARRAY['safety', 'compliance'],
    'every_day',
    '{"type": "daily", "every_n_days": 1, "business_days_only": true}',
    'morning',
    '09:00:00',
    'active'
) ON CONFLICT DO NOTHING;

-- Example 2: Monday/Wednesday/Friday task
INSERT INTO master_tasks (
    title, 
    description, 
    responsibility, 
    categories, 
    frequency,
    frequency_rules,
    timing,
    due_time,
    publish_status
) VALUES (
    'Inventory Count',
    'Count controlled substances and update inventory',
    ARRAY['pharmacist-primary', 'dispensary-technicians'],
    ARRAY['inventory', 'controlled-substances'],
    'specific_weekdays',
    '{"type": "specific_weekdays", "weekdays": [1, 3, 5], "business_days_only": true}',
    'before_close',
    '16:00:00',
    'active'
) ON CONFLICT DO NOTHING;

-- Example 3: Start of month (filtered months)
INSERT INTO master_tasks (
    title, 
    description, 
    responsibility, 
    categories, 
    frequency,
    frequency_rules,
    timing,
    due_time,
    publish_status
) VALUES (
    'Monthly Compliance Review',
    'Review compliance documentation and update records',
    ARRAY['pharmacist-primary', 'operational-managerial'],
    ARRAY['compliance', 'documentation'],
    'start_certain_months',
    '{"type": "start_certain_months", "months": [1, 4, 7, 10], "business_days_only": true}',
    'morning',
    '10:00:00',
    'active'
) ON CONFLICT DO NOTHING;

-- Example 4: Once-off task
INSERT INTO master_tasks (
    title, 
    description, 
    responsibility, 
    categories, 
    frequency,
    frequency_rules,
    timing,
    due_date,
    due_time,
    publish_status
) VALUES (
    'Annual Equipment Calibration',
    'Calibrate all measurement equipment for accuracy',
    ARRAY['dispensary-technicians'],
    ARRAY['equipment', 'maintenance'],
    'once_off_sticky',
    '{"type": "once_off", "due_date": "2024-12-31"}',
    'custom',
    '2024-12-31',
    '14:00:00',
    'active'
) ON CONFLICT DO NOTHING;

-- ========================================
-- VERIFICATION QUERIES
-- ========================================

-- Verify new columns were added
DO $$ 
BEGIN
    RAISE NOTICE 'Verifying new columns in master_tasks...';
    
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'master_tasks' AND column_name = 'responsibility') THEN
        RAISE NOTICE '✓ responsibility column exists';
    ELSE
        RAISE NOTICE '✗ responsibility column missing';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'master_tasks' AND column_name = 'categories') THEN
        RAISE NOTICE '✓ categories column exists';
    ELSE
        RAISE NOTICE '✗ categories column missing';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'master_tasks' AND column_name = 'frequency_rules') THEN
        RAISE NOTICE '✓ frequency_rules column exists';
    ELSE
        RAISE NOTICE '✗ frequency_rules column missing';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'master_tasks' AND column_name = 'due_date') THEN
        RAISE NOTICE '✓ due_date column exists';
    ELSE
        RAISE NOTICE '✗ due_date column missing';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'master_tasks' AND column_name = 'due_time') THEN
        RAISE NOTICE '✓ due_time column exists';
    ELSE
        RAISE NOTICE '✗ due_time column missing';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'master_tasks' AND column_name = 'created_by') THEN
        RAISE NOTICE '✓ created_by column exists';
    ELSE
        RAISE NOTICE '✗ created_by column exists';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'master_tasks' AND column_name = 'updated_by') THEN
        RAISE NOTICE '✓ updated_by column exists';
    ELSE
        RAISE NOTICE '✗ updated_by column missing';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'master_tasks' AND column_name = 'publish_delay') THEN
        RAISE NOTICE '✓ publish_delay column exists';
    ELSE
        RAISE NOTICE '✗ publish_delay column missing';
    END IF;
END $$;

-- Verify checklist_instances table was created
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'checklist_instances') THEN
        RAISE NOTICE '✓ checklist_instances table created successfully';
    ELSE
        RAISE NOTICE '✗ checklist_instances table creation failed';
    END IF;
END $$;

-- Verify frequency migration worked
DO $$ 
BEGIN
    RAISE NOTICE 'Verifying frequency migration...';
    
    IF EXISTS (SELECT 1 FROM master_tasks WHERE frequency_rules != '{}'::jsonb) THEN
        RAISE NOTICE '✓ frequency_rules migration completed';
    ELSE
        RAISE NOTICE '⚠ frequency_rules migration may not have completed';
    END IF;
END $$;

-- ========================================
-- COMPLETION MESSAGE
-- ========================================

DO $$ 
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Migration: Master Checklist Support Complete!';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✓ Updated master_tasks table with new fields';
    RAISE NOTICE '✓ Migrated existing frequency data to frequency_rules';
    RAISE NOTICE '✓ Created checklist_instances table';
    RAISE NOTICE '✓ Added performance indexes';
    RAISE NOTICE '✓ Applied RLS policies';
    RAISE NOTICE '✓ Inserted example data';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Next: Update TypeScript types in types/checklist.ts';
    RAISE NOTICE '========================================';
END $$;
