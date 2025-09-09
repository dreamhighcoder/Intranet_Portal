-- Create a function to update system settings that bypasses RLS
CREATE OR REPLACE FUNCTION update_system_settings_function(
  p_timezone TEXT,
  p_new_since_hour TIME,
  p_missed_cutoff_time TIME,
  p_auto_logout_enabled BOOLEAN,
  p_auto_logout_delay_minutes INTEGER,
  p_task_generation_days_ahead INTEGER,
  p_task_generation_days_behind INTEGER,
  p_working_days TEXT[],
  p_public_holiday_push_forward BOOLEAN
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER -- This allows the function to run with the privileges of the function owner
AS $$
DECLARE
  result JSON;
BEGIN
  -- Update the system_settings table
  UPDATE system_settings 
  SET 
    timezone = p_timezone,
    new_since_hour = p_new_since_hour,
    missed_cutoff_time = p_missed_cutoff_time,
    auto_logout_enabled = p_auto_logout_enabled,
    auto_logout_delay_minutes = p_auto_logout_delay_minutes,
    task_generation_days_ahead = p_task_generation_days_ahead,
    task_generation_days_behind = p_task_generation_days_behind,
    working_days = p_working_days,
    public_holiday_push_forward = p_public_holiday_push_forward,
    updated_at = NOW()
  WHERE id = (SELECT id FROM system_settings LIMIT 1);
  
  -- If no rows were updated, insert a new row
  IF NOT FOUND THEN
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
    ) VALUES (
      p_timezone,
      p_new_since_hour,
      p_missed_cutoff_time,
      p_auto_logout_enabled,
      p_auto_logout_delay_minutes,
      p_task_generation_days_ahead,
      p_task_generation_days_behind,
      p_working_days,
      p_public_holiday_push_forward,
      NOW(),
      NOW()
    );
  END IF;
  
  -- Return success
  result := json_build_object('success', true, 'message', 'Settings updated successfully');
  RETURN result;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Return error details
    result := json_build_object(
      'success', false, 
      'error', SQLERRM,
      'error_code', SQLSTATE
    );
    RETURN result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION update_system_settings_function TO authenticated;
GRANT EXECUTE ON FUNCTION update_system_settings_function TO service_role;