-- Migration: Create Public Holidays Table
-- Date: 2024-12-19
-- Description: Creates public_holidays table for managing holidays that affect task scheduling
-- Safe to run multiple times (uses IF NOT EXISTS)

-- ========================================
-- CREATE PUBLIC_HOLIDAYS TABLE
-- ========================================

-- Create public_holidays table if it doesn't exist
CREATE TABLE IF NOT EXISTS public_holidays (
    date DATE NOT NULL,
    name TEXT NOT NULL,
    region TEXT DEFAULT 'National',
    source TEXT DEFAULT 'manual',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (date, region)
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_public_holidays_date ON public_holidays(date);
CREATE INDEX IF NOT EXISTS idx_public_holidays_region ON public_holidays(region);
CREATE INDEX IF NOT EXISTS idx_public_holidays_year ON public_holidays(EXTRACT(YEAR FROM date));

-- ========================================
-- ADD SAMPLE HOLIDAYS (2024-2025)
-- ========================================

-- Insert sample Australian public holidays for 2024-2025
-- These are common holidays that most businesses observe
INSERT INTO public_holidays (date, name, region, source) VALUES
-- 2024 Holidays
('2024-01-01', 'New Year''s Day', 'National', 'sample'),
('2024-01-26', 'Australia Day', 'National', 'sample'),
('2024-03-29', 'Good Friday', 'National', 'sample'),
('2024-03-31', 'Easter Sunday', 'National', 'sample'),
('2024-04-01', 'Easter Monday', 'National', 'sample'),
('2024-04-25', 'ANZAC Day', 'National', 'sample'),
('2024-06-10', 'King''s Birthday', 'National', 'sample'),
('2024-09-30', 'Labour Day', 'National', 'sample'),
('2024-12-25', 'Christmas Day', 'National', 'sample'),
('2024-12-26', 'Boxing Day', 'National', 'sample'),

-- 2025 Holidays
('2025-01-01', 'New Year''s Day', 'National', 'sample'),
('2025-01-27', 'Australia Day', 'National', 'sample'),
('2025-04-18', 'Good Friday', 'National', 'sample'),
('2025-04-20', 'Easter Sunday', 'National', 'sample'),
('2025-04-21', 'Easter Monday', 'National', 'sample'),
('2025-04-25', 'ANZAC Day', 'National', 'sample'),
('2025-06-09', 'King''s Birthday', 'National', 'sample'),
('2025-09-29', 'Labour Day', 'National', 'sample'),
('2025-12-25', 'Christmas Day', 'National', 'sample'),
('2025-12-26', 'Boxing Day', 'National', 'sample')
ON CONFLICT (date, region) DO NOTHING;

-- ========================================
-- ADD ROW LEVEL SECURITY (RLS)
-- ========================================

-- Enable RLS on public_holidays table
ALTER TABLE public_holidays ENABLE ROW LEVEL SECURITY;

-- Create policies for public_holidays table
-- Allow all authenticated users to read holidays (needed for task scheduling)
CREATE POLICY IF NOT EXISTS "Allow authenticated users to read public holidays" ON public_holidays
    FOR SELECT USING (auth.role() = 'authenticated');

-- Allow only admins to insert, update, and delete holidays
CREATE POLICY IF NOT EXISTS "Allow admins to manage public holidays" ON public_holidays
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_profiles.id = auth.uid() 
            AND user_profiles.role = 'admin'
        )
    );

-- ========================================
-- ADD AUDIT LOGGING SUPPORT
-- ========================================

-- Create a trigger function to log changes to public_holidays
CREATE OR REPLACE FUNCTION log_public_holidays_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_log (
            task_instance_id,
            user_id,
            action,
            old_values,
            new_values,
            metadata
        ) VALUES (
            NULL,
            auth.uid(),
            'holiday_created',
            NULL,
            to_jsonb(NEW),
            jsonb_build_object(
                'table', 'public_holidays',
                'operation', 'INSERT',
                'timestamp', NOW()
            )
        );
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_log (
            task_instance_id,
            user_id,
            action,
            old_values,
            new_values,
            metadata
        ) VALUES (
            NULL,
            auth.uid(),
            'holiday_updated',
            to_jsonb(OLD),
            to_jsonb(NEW),
            jsonb_build_object(
                'table', 'public_holidays',
                'operation', 'UPDATE',
                'timestamp', NOW()
            )
        );
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_log (
            task_instance_id,
            user_id,
            action,
            old_values,
            new_values,
            metadata
        ) VALUES (
            NULL,
            auth.uid(),
            'holiday_deleted',
            to_jsonb(OLD),
            NULL,
            jsonb_build_object(
                'table', 'public_holidays',
                'operation', 'DELETE',
                'timestamp', NOW()
            )
        );
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for public_holidays table
DROP TRIGGER IF EXISTS trigger_log_public_holidays_changes ON public_holidays;
CREATE TRIGGER trigger_log_public_holidays_changes
    AFTER INSERT OR UPDATE OR DELETE ON public_holidays
    FOR EACH ROW EXECUTE FUNCTION log_public_holidays_changes();

-- ========================================
-- VERIFICATION
-- ========================================

-- Verify the table was created successfully
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'public_holidays') THEN
        RAISE NOTICE 'Public holidays table created successfully';
    ELSE
        RAISE EXCEPTION 'Failed to create public holidays table';
    END IF;
    
    -- Check if sample data was inserted
    IF EXISTS (SELECT 1 FROM public_holidays LIMIT 1) THEN
        RAISE NOTICE 'Sample holidays inserted successfully';
    ELSE
        RAISE NOTICE 'No sample holidays found (table may be empty)';
    END IF;
END $$;
