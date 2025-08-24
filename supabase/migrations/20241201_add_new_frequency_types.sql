-- Migration: Add New Frequency Types Support
-- Date: 2024-12-01
-- Description: Add support for the new comprehensive frequency types and update master_tasks table

-- ========================================
-- ADD NEW FREQUENCY COLUMN
-- ========================================

-- Add new frequencies column to support array of frequency types
ALTER TABLE master_tasks 
ADD COLUMN IF NOT EXISTS frequencies TEXT[] DEFAULT '{}';

-- Add new fields to support the new recurrence engine
ALTER TABLE master_tasks 
ADD COLUMN IF NOT EXISTS start_date DATE,
ADD COLUMN IF NOT EXISTS end_date DATE,
ADD COLUMN IF NOT EXISTS publish_at DATE;

-- Add new fields to task_instances for better tracking
ALTER TABLE task_instances 
ADD COLUMN IF NOT EXISTS due_date_override DATE,
ADD COLUMN IF NOT EXISTS due_time_override TIME,
ADD COLUMN IF NOT EXISTS is_carry_instance BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS original_appearance_date DATE;

-- ========================================
-- UPDATE FREQUENCY CONSTRAINTS
-- ========================================

-- Drop the old frequency constraint
ALTER TABLE master_tasks 
DROP CONSTRAINT IF EXISTS master_tasks_frequency_check;

-- Add new frequency constraint that includes all the new frequency types
ALTER TABLE master_tasks 
ADD CONSTRAINT master_tasks_frequency_check 
CHECK (frequency IN (
    -- Legacy frequency types (for backward compatibility)
    'once_off_sticky', 'every_day', 'weekly', 'specific_weekdays',
    'start_every_month', 'start_certain_months', 'every_month',
    'certain_months', 'end_every_month', 'end_certain_months',
    
    -- New comprehensive frequency types
    'once_off', 'every_day', 'once_weekly',
    'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
    'once_monthly', 'start_of_every_month',
    'start_of_month_jan', 'start_of_month_feb', 'start_of_month_mar',
    'start_of_month_apr', 'start_of_month_may', 'start_of_month_jun',
    'start_of_month_jul', 'start_of_month_aug', 'start_of_month_sep',
    'start_of_month_oct', 'start_of_month_nov', 'start_of_month_dec',
    'end_of_every_month',
    'end_of_month_jan', 'end_of_month_feb', 'end_of_month_mar',
    'end_of_month_apr', 'end_of_month_may', 'end_of_month_jun',
    'end_of_month_jul', 'end_of_month_aug', 'end_of_month_sep',
    'end_of_month_oct', 'end_of_month_nov', 'end_of_month_dec'
));

-- ========================================
-- UPDATE STATUS CONSTRAINTS
-- ========================================

-- Drop the old status constraint
ALTER TABLE task_instances 
DROP CONSTRAINT IF EXISTS task_instances_status_check;

-- Add new status constraint with the new status types
ALTER TABLE task_instances 
ADD CONSTRAINT task_instances_status_check 
CHECK (status IN ('pending', 'overdue', 'missed', 'done'));

-- ========================================
-- CREATE INDEXES FOR NEW COLUMNS
-- ========================================

-- Index for new frequencies column
CREATE INDEX IF NOT EXISTS idx_master_tasks_frequencies ON master_tasks USING GIN(frequencies);

-- Index for new date columns
CREATE INDEX IF NOT EXISTS idx_master_tasks_start_date ON master_tasks(start_date);
CREATE INDEX IF NOT EXISTS idx_master_tasks_end_date ON master_tasks(end_date);
CREATE INDEX IF NOT EXISTS idx_master_tasks_publish_at ON master_tasks(publish_at);

-- Index for new task instance columns
CREATE INDEX IF NOT EXISTS idx_task_instances_due_date_override ON task_instances(due_date_override);
CREATE INDEX IF NOT EXISTS idx_task_instances_is_carry_instance ON task_instances(is_carry_instance);
CREATE INDEX IF NOT EXISTS idx_task_instances_original_appearance_date ON task_instances(original_appearance_date);

-- ========================================
-- DATA MIGRATION FUNCTION
-- ========================================

-- Function to migrate existing frequency data to new format
CREATE OR REPLACE FUNCTION migrate_frequency_data()
RETURNS void AS $$
DECLARE
    task_record RECORD;
    new_frequencies TEXT[];
BEGIN
    -- Loop through all master tasks and convert frequency data
    FOR task_record IN 
        SELECT id, frequency, weekdays, months 
        FROM master_tasks 
        WHERE frequencies = '{}' OR frequencies IS NULL
    LOOP
        new_frequencies := '{}';
        
        -- Convert legacy frequency to new format
        CASE task_record.frequency
            WHEN 'once_off_sticky' THEN
                new_frequencies := ARRAY['once_off'];
            WHEN 'every_day' THEN
                new_frequencies := ARRAY['every_day'];
            WHEN 'weekly' THEN
                new_frequencies := ARRAY['once_weekly'];
            WHEN 'specific_weekdays' THEN
                -- Convert weekdays array to specific weekday frequencies
                IF 1 = ANY(task_record.weekdays) THEN
                    new_frequencies := array_append(new_frequencies, 'monday');
                END IF;
                IF 2 = ANY(task_record.weekdays) THEN
                    new_frequencies := array_append(new_frequencies, 'tuesday');
                END IF;
                IF 3 = ANY(task_record.weekdays) THEN
                    new_frequencies := array_append(new_frequencies, 'wednesday');
                END IF;
                IF 4 = ANY(task_record.weekdays) THEN
                    new_frequencies := array_append(new_frequencies, 'thursday');
                END IF;
                IF 5 = ANY(task_record.weekdays) THEN
                    new_frequencies := array_append(new_frequencies, 'friday');
                END IF;
                IF 6 = ANY(task_record.weekdays) THEN
                    new_frequencies := array_append(new_frequencies, 'saturday');
                END IF;
            WHEN 'start_every_month' THEN
                new_frequencies := ARRAY['start_of_every_month'];
            WHEN 'start_certain_months' THEN
                -- Convert months array to specific month frequencies
                IF 1 = ANY(task_record.months) THEN
                    new_frequencies := array_append(new_frequencies, 'start_of_month_jan');
                END IF;
                IF 2 = ANY(task_record.months) THEN
                    new_frequencies := array_append(new_frequencies, 'start_of_month_feb');
                END IF;
                IF 3 = ANY(task_record.months) THEN
                    new_frequencies := array_append(new_frequencies, 'start_of_month_mar');
                END IF;
                IF 4 = ANY(task_record.months) THEN
                    new_frequencies := array_append(new_frequencies, 'start_of_month_apr');
                END IF;
                IF 5 = ANY(task_record.months) THEN
                    new_frequencies := array_append(new_frequencies, 'start_of_month_may');
                END IF;
                IF 6 = ANY(task_record.months) THEN
                    new_frequencies := array_append(new_frequencies, 'start_of_month_jun');
                END IF;
                IF 7 = ANY(task_record.months) THEN
                    new_frequencies := array_append(new_frequencies, 'start_of_month_jul');
                END IF;
                IF 8 = ANY(task_record.months) THEN
                    new_frequencies := array_append(new_frequencies, 'start_of_month_aug');
                END IF;
                IF 9 = ANY(task_record.months) THEN
                    new_frequencies := array_append(new_frequencies, 'start_of_month_sep');
                END IF;
                IF 10 = ANY(task_record.months) THEN
                    new_frequencies := array_append(new_frequencies, 'start_of_month_oct');
                END IF;
                IF 11 = ANY(task_record.months) THEN
                    new_frequencies := array_append(new_frequencies, 'start_of_month_nov');
                END IF;
                IF 12 = ANY(task_record.months) THEN
                    new_frequencies := array_append(new_frequencies, 'start_of_month_dec');
                END IF;
            WHEN 'every_month' THEN
                new_frequencies := ARRAY['once_monthly'];
            WHEN 'certain_months' THEN
                new_frequencies := ARRAY['once_monthly']; -- Fallback
            WHEN 'end_every_month' THEN
                new_frequencies := ARRAY['end_of_every_month'];
            WHEN 'end_certain_months' THEN
                -- Convert months array to specific end-of-month frequencies
                IF 1 = ANY(task_record.months) THEN
                    new_frequencies := array_append(new_frequencies, 'end_of_month_jan');
                END IF;
                IF 2 = ANY(task_record.months) THEN
                    new_frequencies := array_append(new_frequencies, 'end_of_month_feb');
                END IF;
                IF 3 = ANY(task_record.months) THEN
                    new_frequencies := array_append(new_frequencies, 'end_of_month_mar');
                END IF;
                IF 4 = ANY(task_record.months) THEN
                    new_frequencies := array_append(new_frequencies, 'end_of_month_apr');
                END IF;
                IF 5 = ANY(task_record.months) THEN
                    new_frequencies := array_append(new_frequencies, 'end_of_month_may');
                END IF;
                IF 6 = ANY(task_record.months) THEN
                    new_frequencies := array_append(new_frequencies, 'end_of_month_jun');
                END IF;
                IF 7 = ANY(task_record.months) THEN
                    new_frequencies := array_append(new_frequencies, 'end_of_month_jul');
                END IF;
                IF 8 = ANY(task_record.months) THEN
                    new_frequencies := array_append(new_frequencies, 'end_of_month_aug');
                END IF;
                IF 9 = ANY(task_record.months) THEN
                    new_frequencies := array_append(new_frequencies, 'end_of_month_sep');
                END IF;
                IF 10 = ANY(task_record.months) THEN
                    new_frequencies := array_append(new_frequencies, 'end_of_month_oct');
                END IF;
                IF 11 = ANY(task_record.months) THEN
                    new_frequencies := array_append(new_frequencies, 'end_of_month_nov');
                END IF;
                IF 12 = ANY(task_record.months) THEN
                    new_frequencies := array_append(new_frequencies, 'end_of_month_dec');
                END IF;
            ELSE
                -- Default fallback
                new_frequencies := ARRAY['every_day'];
        END CASE;
        
        -- Update the task with new frequencies
        UPDATE master_tasks 
        SET frequencies = new_frequencies
        WHERE id = task_record.id;
        
    END LOOP;
    
    RAISE NOTICE 'Frequency data migration completed successfully';
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- RUN DATA MIGRATION
-- ========================================

-- Execute the migration function
SELECT migrate_frequency_data();

-- ========================================
-- CLEANUP
-- ========================================

-- Drop the migration function as it's no longer needed
DROP FUNCTION IF EXISTS migrate_frequency_data();

-- Add comment to track migration
COMMENT ON COLUMN master_tasks.frequencies IS 'New comprehensive frequency types array - migrated from legacy frequency field';
COMMENT ON COLUMN master_tasks.start_date IS 'Task becomes active from this date';
COMMENT ON COLUMN master_tasks.end_date IS 'Task expires after this date';
COMMENT ON COLUMN master_tasks.publish_at IS 'No instances created before this date';