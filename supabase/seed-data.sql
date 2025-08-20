-- Insert Positions
INSERT INTO positions (id, name, description) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 'Pharmacist (Primary)', 'Lead pharmacist responsible for clinical oversight'),
  ('550e8400-e29b-41d4-a716-446655440002', 'Pharmacist (Supporting)', 'Supporting pharmacist for dispensing and clinical duties'),
  ('550e8400-e29b-41d4-a716-446655440003', 'Pharmacy Assistants', 'Front-of-house customer service and basic pharmacy tasks'),
  ('550e8400-e29b-41d4-a716-446655440004', 'Dispensary Technicians', 'Dispensing medication and inventory management'),
  ('550e8400-e29b-41d4-a716-446655440005', 'DAA Packers', 'Dose Administration Aid packaging and preparation'),
  ('550e8400-e29b-41d4-a716-446655440006', 'Operational/Managerial', 'Management and operational oversight tasks');

-- Insert some sample Master Tasks
INSERT INTO master_tasks (
  title, description, responsibility, categories, frequencies, timing, due_time, 
  publish_status
) VALUES
  -- Daily tasks for Pharmacist Primary
  ('Daily Register Check', 'Verify controlled substances register is complete and accurate', 
   ARRAY['pharmacist-primary'], ARRAY['compliance'], ARRAY['every_day'], 'opening', '09:00:00', 
   'active'),
   
  ('Daily Temperature Log', 'Record and verify refrigeration temperatures', 
   ARRAY['pharmacist-primary'], ARRAY['pharmacy-services'], ARRAY['every_day'], 'opening', '08:30:00', 
   'active'),
   
  -- Weekly tasks
  ('Weekly Safety Review', 'Review weekly safety incidents and near misses', 
   ARRAY['pharmacist-primary'], ARRAY['compliance'], ARRAY['once_weekly'], 'opening', '09:30:00', 
   'active'),
   
  -- Monthly tasks for all positions
  ('Monthly Inventory Count', 'Complete monthly inventory count for assigned areas', 
   ARRAY['dispensary-technicians'], ARRAY['stock-control'], ARRAY['start_of_every_month'], 'opening', '08:00:00', 
   'active'),
   
  -- Once-off sticky task
  ('Annual CPR Training', 'Complete mandatory CPR training certification', 
   ARRAY['pharmacist-primary'], ARRAY['compliance'], ARRAY['once_off'], 'anytime_during_day', '17:00:00', 
   'active'),
   
  -- Specific weekdays (Monday, Wednesday, Friday)
  ('Delivery Schedule Check', 'Review and confirm upcoming delivery schedules', 
   ARRAY['operational-managerial'], ARRAY['business-management'], ARRAY['monday', 'wednesday', 'friday'], 'opening', '08:15:00', 
   'active'),
   
  -- End of month task
  ('Monthly P&L Review', 'Review monthly profit and loss statements', 
   ARRAY['operational-managerial'], ARRAY['business-management'], ARRAY['end_of_every_month'], 'closing', '16:00:00', 
   'active');

-- Note: Weekdays are now handled through the frequencies array

-- Insert some sample public holidays for Australia
INSERT INTO public_holidays (date, name, region, source) VALUES
  ('2024-01-01', 'New Year''s Day', 'National', 'data.gov.au'),
  ('2024-01-26', 'Australia Day', 'National', 'data.gov.au'),
  ('2024-03-29', 'Good Friday', 'National', 'data.gov.au'),
  ('2024-04-01', 'Easter Monday', 'National', 'data.gov.au'),
  ('2024-04-25', 'Anzac Day', 'National', 'data.gov.au'),
  ('2024-06-10', 'Queen''s Birthday', 'Most States', 'data.gov.au'),
  ('2024-12-25', 'Christmas Day', 'National', 'data.gov.au'),
  ('2024-12-26', 'Boxing Day', 'National', 'data.gov.au'),
  ('2025-01-01', 'New Year''s Day', 'National', 'data.gov.au'),
  ('2025-01-27', 'Australia Day', 'National', 'data.gov.au'),
  ('2025-04-18', 'Good Friday', 'National', 'data.gov.au'),
  ('2025-04-21', 'Easter Monday', 'National', 'data.gov.au'),
  ('2025-04-25', 'Anzac Day', 'National', 'data.gov.au'),
  ('2025-06-09', 'Queen''s Birthday', 'Most States', 'data.gov.au'),
  ('2025-12-25', 'Christmas Day', 'National', 'data.gov.au'),
  ('2025-12-26', 'Boxing Day', 'National', 'data.gov.au');

-- Insert default system settings
INSERT INTO system_settings (key, value, description, data_type, is_public) VALUES
  -- Business Rules
  ('timezone', 'Australia/Sydney', 'Default timezone for the pharmacy', 'string', true),
  ('new_since_hour', '09:00', 'Hour to mark tasks as "new since" for the day', 'string', true),
  ('business_days', '[1,2,3,4,5,6]', 'Business operating days (1=Mon, 2=Tue, etc, 6=Sat)', 'json', true),
  ('workday_start_time', '08:00', 'Standard workday start time', 'string', true),
  ('workday_end_time', '18:00', 'Standard workday end time', 'string', true),
  
  -- Task Cutoff Times
  ('daily_task_cutoff', '23:59', 'Cutoff time for daily tasks (Every Day, Weekly)', 'string', false),
  ('weekly_task_cutoff', '23:59', 'Cutoff time for weekly tasks on Saturday', 'string', false),
  ('monthly_task_cutoff', '23:59', 'Cutoff time for monthly tasks on last Saturday', 'string', false),
  ('specific_weekdays_cutoff', '23:59', 'Cutoff time for specific weekdays tasks on Saturday', 'string', false),
  
  -- Due Date Calculation Rules
  ('start_of_month_workdays', '5', 'Number of full workdays for start-of-month tasks', 'number', false),
  ('month_end_calculation', 'last_saturday', 'How to calculate month end dates (last_saturday)', 'string', false),
  
  -- Auto-logout Settings
  ('auto_logout_enabled', 'true', 'Enable auto-logout after completing all tasks', 'boolean', true),
  ('auto_logout_delay_seconds', '3', 'Delay in seconds before auto-logout', 'number', true),
  
  -- Task Generation Settings
  ('task_generation_days_back', '30', 'Days in the past to generate tasks for', 'number', false),
  ('task_generation_days_forward', '365', 'Days in the future to generate tasks for', 'number', false),
  ('task_generation_enabled', 'true', 'Enable automatic task generation', 'boolean', false),
  
  -- Public Holiday Rules
  ('ph_substitution_enabled', 'true', 'Enable public holiday substitution rules', 'boolean', false),
  ('ph_source_url', 'https://data.gov.au/api/3/action/datastore_search?resource_id=a24ecaf2-044a-4e66-989c-eacc81ded62f', 'URL for public holidays API', 'string', false),
  
  -- Notification Settings
  ('email_notifications_enabled', 'false', 'Enable email notifications', 'boolean', false),
  ('notification_sender_email', 'noreply@pharmacy.local', 'Sender email for notifications', 'string', false),
  
  -- Reporting Settings
  ('default_report_period_days', '30', 'Default period for reports in days', 'number', true),
  ('kpi_calculation_period_days', '30', 'Period for KPI calculations in days', 'number', false),
  
  -- UI Settings
  ('default_view', 'list', 'Default task view (list or card)', 'string', true),
  ('tasks_per_page', '50', 'Number of tasks to show per page', 'number', true),
  ('show_category_colors', 'true', 'Show category colors in task display', 'boolean', true),
  
  -- Audit Settings
  ('audit_retention_days', '365', 'Days to retain audit log entries', 'number', false),
  ('detailed_audit_enabled', 'true', 'Enable detailed audit logging', 'boolean', false),
  
  -- Pharmacy Specific Settings
  ('pharmacy_name', 'Local Pharmacy', 'Name of the pharmacy', 'string', true),
  ('controlled_substances_register_required', 'true', 'Require controlled substances register checks', 'boolean', false),
  ('temperature_logging_required', 'true', 'Require temperature logging', 'boolean', false),
  
  -- System Info
  ('system_version', '1.0.0', 'Current system version', 'string', true),
  ('last_database_update', '2024-01-01', 'Last database schema update date', 'string', false);

-- Insert sample task instances (this would normally be done by the task generator)
-- These are for demo/testing purposes
INSERT INTO task_instances (
  master_task_id, instance_date, due_date, due_time, status, is_published
) VALUES
  -- Today's tasks
  ((SELECT id FROM master_tasks WHERE title = 'Daily Register Check'), 
   CURRENT_DATE, CURRENT_DATE, '09:00:00', 'due_today', true),
  ((SELECT id FROM master_tasks WHERE title = 'Daily Temperature Log'), 
   CURRENT_DATE, CURRENT_DATE, '08:30:00', 'due_today', true),
   
  -- Yesterday's completed task
  ((SELECT id FROM master_tasks WHERE title = 'Daily Register Check'), 
   CURRENT_DATE - 1, CURRENT_DATE - 1, '09:00:00', 'done', true),
  ((SELECT id FROM master_tasks WHERE title = 'Daily Temperature Log'), 
   CURRENT_DATE - 1, CURRENT_DATE - 1, '08:30:00', 'done', true),
   
  -- Weekly task for this week
  ((SELECT id FROM master_tasks WHERE title = 'Weekly Safety Review'), 
   DATE_TRUNC('week', CURRENT_DATE) + INTERVAL '0 days', -- This Monday
   DATE_TRUNC('week', CURRENT_DATE) + INTERVAL '0 days', 
   '09:30:00', 'not_due', true),
   
  -- Monthly task for this month
  ((SELECT id FROM master_tasks WHERE title = 'Monthly Inventory Count'), 
   DATE_TRUNC('month', CURRENT_DATE), 
   DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '4 days', -- +5 workdays (approx)
   '08:00:00', 'not_due', true),
   
  -- Overdue task from 2 days ago
  ((SELECT id FROM master_tasks WHERE title = 'Daily Register Check'), 
   CURRENT_DATE - 2, CURRENT_DATE - 2, '09:00:00', 'overdue', true);