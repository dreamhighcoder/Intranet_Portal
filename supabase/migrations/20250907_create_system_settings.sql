-- Create system_settings table for storing application configuration
CREATE TABLE IF NOT EXISTS system_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Timezone and regional settings
    timezone TEXT NOT NULL DEFAULT 'Australia/Hobart',
    
    -- Task timing settings
    new_since_hour TIME NOT NULL DEFAULT '00:00:00',
    missed_cutoff_time TIME NOT NULL DEFAULT '23:59:00',
    default_due_time TIME NOT NULL DEFAULT '17:00:00',
    
    -- Task generation settings
    task_generation_days_ahead INTEGER NOT NULL DEFAULT 999999,
    task_generation_days_behind INTEGER NOT NULL DEFAULT 0,
    working_days TEXT[] NOT NULL DEFAULT ARRAY['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
    public_holiday_push_forward BOOLEAN NOT NULL DEFAULT true,
    
    -- Security settings
    auto_logout_enabled BOOLEAN NOT NULL DEFAULT true,
    auto_logout_delay_minutes INTEGER NOT NULL DEFAULT 5,
    
    -- Audit fields
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id),
    
    -- Constraints
    CONSTRAINT valid_timezone CHECK (timezone IN (
        'Australia/Hobart', 'Australia/Melbourne', 'Australia/Brisbane',
        'Australia/Adelaide', 'Australia/Perth', 'Australia/Darwin',
        'Australia/Hobart'
    )),
    CONSTRAINT valid_days_ahead CHECK (task_generation_days_ahead >= 1 AND task_generation_days_ahead <= 730),
    CONSTRAINT valid_days_behind CHECK (task_generation_days_behind >= 0 AND task_generation_days_behind <= 90),
    CONSTRAINT valid_logout_delay CHECK (auto_logout_delay_minutes >= 1 AND auto_logout_delay_minutes <= 60),
    CONSTRAINT valid_working_days CHECK (
        working_days <@ ARRAY['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
        AND array_length(working_days, 1) > 0
    )
);

-- Create index for faster lookups (there should only be one row, but good practice)
CREATE INDEX IF NOT EXISTS idx_system_settings_updated_at ON system_settings(updated_at DESC);

-- Insert default settings if none exist
INSERT INTO system_settings (
    timezone,
    new_since_hour,
    missed_cutoff_time,
    default_due_time,
    task_generation_days_ahead,
    task_generation_days_behind,
    working_days,
    public_holiday_push_forward,
    auto_logout_enabled,
    auto_logout_delay_minutes
) 
SELECT 
    'Australia/Hobart',
    '00:00:00',
    '23:59:00',
    '17:00:00',
    999999,
    0,
    ARRAY['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
    true,
    true,
    5
WHERE NOT EXISTS (SELECT 1 FROM system_settings);

-- Enable RLS
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Only admins can read system settings
CREATE POLICY "Admins can read system settings" ON system_settings
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_profiles.id = auth.uid() 
            AND user_profiles.role = 'admin'
        )
    );

-- Only admins can update system settings
CREATE POLICY "Admins can update system settings" ON system_settings
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_profiles.id = auth.uid() 
            AND user_profiles.role = 'admin'
        )
    );

-- Only admins can insert system settings
CREATE POLICY "Admins can insert system settings" ON system_settings
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_profiles.id = auth.uid() 
            AND user_profiles.role = 'admin'
        )
    );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_system_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.updated_by = auth.uid();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER trigger_update_system_settings_updated_at
    BEFORE UPDATE ON system_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_system_settings_updated_at();

-- Add comment to table
COMMENT ON TABLE system_settings IS 'System-wide configuration settings for the Richmond Pharmacy Intranet Portal';
COMMENT ON COLUMN system_settings.timezone IS 'System timezone for all date/time operations';
COMMENT ON COLUMN system_settings.new_since_hour IS 'Time when tasks become "new" each day';
COMMENT ON COLUMN system_settings.missed_cutoff_time IS 'Time when incomplete tasks become "missed"';
COMMENT ON COLUMN system_settings.default_due_time IS 'Default due time for tasks when not specified';
COMMENT ON COLUMN system_settings.task_generation_days_ahead IS 'How many days ahead to generate task instances';
COMMENT ON COLUMN system_settings.task_generation_days_behind IS 'How many days behind to generate task instances';
COMMENT ON COLUMN system_settings.working_days IS 'Days of the week when tasks should be generated';
COMMENT ON COLUMN system_settings.public_holiday_push_forward IS 'Whether to push tasks forward when they fall on public holidays';
COMMENT ON COLUMN system_settings.auto_logout_enabled IS 'Whether to automatically log out inactive users';
COMMENT ON COLUMN system_settings.auto_logout_delay_minutes IS 'Minutes of inactivity before automatic logout';