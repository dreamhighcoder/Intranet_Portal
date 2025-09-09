-- Fix system_settings trigger to handle null auth.uid() in server context
CREATE OR REPLACE FUNCTION update_system_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    -- Only set updated_by if auth.uid() is not null (to handle server-side updates)
    IF auth.uid() IS NOT NULL THEN
        NEW.updated_by = auth.uid();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;