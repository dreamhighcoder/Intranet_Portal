-- Add missing system settings that the frontend expects
-- This ensures all required settings exist in the key-value structure

-- Insert missing settings if they don't exist
INSERT INTO system_settings (key, value, description, data_type, is_public) 
SELECT * FROM (VALUES
    -- Ensure all required settings exist
    ('timezone', 'Australia/Sydney', 'Default timezone for the pharmacy', 'string', true),
    ('new_since_hour', '09:00', 'Hour to mark tasks as "new since" for the day', 'string', true),
    ('daily_task_cutoff', '23:59', 'Cutoff time for daily tasks (Every Day, Weekly)', 'string', false),
    ('auto_logout_enabled', 'true', 'Enable auto-logout after completing all tasks', 'boolean', true),
    ('auto_logout_delay_seconds', '300', 'Delay in seconds before auto-logout (5 minutes default)', 'number', true),
    ('task_generation_days_forward', '365', 'Days in the future to generate tasks for', 'number', false),
    ('task_generation_days_back', '30', 'Days in the past to generate tasks for', 'number', false),
    ('business_days', '[1,2,3,4,5,6]', 'Business operating days (1=Mon, 2=Tue, etc, 6=Sat)', 'json', true),
    ('ph_substitution_enabled', 'true', 'Enable public holiday substitution rules', 'boolean', false)
) AS new_settings(key, value, description, data_type, is_public)
WHERE NOT EXISTS (
    SELECT 1 FROM system_settings WHERE system_settings.key = new_settings.key
);

-- Update the auto_logout_delay_seconds to a reasonable default if it's too low
UPDATE system_settings 
SET value = '300', updated_at = NOW()
WHERE key = 'auto_logout_delay_seconds' 
AND CAST(value AS INTEGER) < 60;

-- Verify the settings
SELECT 'System settings verification:' as info;
SELECT key, value, data_type, is_public 
FROM system_settings 
WHERE key IN (
    'timezone', 'new_since_hour', 'daily_task_cutoff', 
    'auto_logout_enabled', 'auto_logout_delay_seconds',
    'task_generation_days_forward', 'task_generation_days_back',
    'business_days', 'ph_substitution_enabled'
)
ORDER BY key;