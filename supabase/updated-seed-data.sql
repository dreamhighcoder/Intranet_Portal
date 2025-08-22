-- Updated Seed Data for Pharmacy Intranet Portal
-- This file includes proper master tasks for all positions with the new schema

-- First, ensure all positions exist
INSERT INTO positions (id, name, description) VALUES
  (gen_random_uuid(), 'Pharmacist (Primary)', 'Lead pharmacist responsible for clinical oversight'),
  (gen_random_uuid(), 'Pharmacist (Supporting)', 'Supporting pharmacist for dispensing and clinical duties'),
  (gen_random_uuid(), 'Pharmacy Assistants', 'Front-of-house customer service and basic pharmacy tasks'),
  (gen_random_uuid(), 'Dispensary Technicians', 'Dispensing medication and inventory management'),
  (gen_random_uuid(), 'DAA Packers', 'Dose Administration Aid packaging and preparation'),
  (gen_random_uuid(), 'Operational/Managerial', 'Management and operational oversight tasks')
ON CONFLICT (name) DO NOTHING;

-- Clear existing master tasks to avoid conflicts
DELETE FROM master_tasks;

-- Insert comprehensive master tasks for all positions using the current schema
INSERT INTO master_tasks (
  title, 
  description, 
  responsibility, 
  categories, 
  frequencies,
  timing, 
  due_time, 
  publish_status
) VALUES

-- ========================================
-- PHARMACIST (PRIMARY) TASKS
-- ========================================

-- Daily tasks
('Daily Register Check', 
 'Verify controlled substances register is complete and accurate', 
 ARRAY['pharmacist-primary'], 
 ARRAY['compliance'], 
 ARRAY['every_day'],
 'opening', 
 '09:00:00', 
 'active'),

('Daily Temperature Log', 
 'Record and verify refrigeration temperatures', 
 ARRAY['pharmacist-primary'], 
 ARRAY['pharmacy-services'], 
 ARRAY['every_day'],
 'opening', 
 '08:30:00', 
 'active'),

('Daily Clinical Review', 
 'Review clinical interventions and patient consultations', 
 ARRAY['pharmacist-primary'], 
 ARRAY['clinical'], 
 ARRAY['every_day'],
 'closing', 
 '16:30:00', 
 'active'),

-- Weekly tasks
('Weekly Safety Review', 
 'Review weekly safety incidents and near misses', 
 ARRAY['pharmacist-primary'], 
 ARRAY['compliance'], 
 ARRAY['once_weekly'],
 'opening', 
 '09:30:00', 
 'active'),

-- Monthly tasks
('Monthly Compliance Audit', 
 'Complete monthly compliance audit and documentation', 
 ARRAY['pharmacist-primary'], 
 ARRAY['compliance'], 
 ARRAY['start_of_every_month'],
 'anytime_during_day', 
 '14:00:00', 
 'active'),

-- ========================================
-- PHARMACIST (SUPPORTING) TASKS
-- ========================================

('Daily Prescription Review', 
 'Review and verify prescriptions for accuracy', 
 ARRAY['pharmacist-supporting'], 
 ARRAY['clinical'], 
 ARRAY['every_day'],
 'anytime_during_day', 
 '11:00:00', 
 'active'),

('Weekly Inventory Spot Check', 
 'Perform spot checks on high-value inventory items', 
 ARRAY['pharmacist-supporting'], 
 ARRAY['inventory'], 
 ARRAY['once_weekly'],
 'anytime_during_day', 
 '15:00:00', 
 'active'),

-- ========================================
-- PHARMACY ASSISTANTS TASKS
-- ========================================

('Daily Customer Service Check', 
 'Review customer service standards and waiting area', 
 ARRAY['pharmacy-assistants'], 
 ARRAY['customer-service'], 
 ARRAY['every_day'],
 'opening', 
 '08:45:00', 
 'active'),

('Daily Till Reconciliation', 
 'Reconcile daily till and payment processing', 
 ARRAY['pharmacy-assistants'], 
 ARRAY['financial'], 
 ARRAY['every_day'],
 'closing', 
 '17:15:00', 
 'active'),

('Weekly Display Update', 
 'Update promotional displays and health information', 
 ARRAY['pharmacy-assistants'], 
 ARRAY['marketing'], 
 ARRAY['once_weekly'],
 'anytime_during_day', 
 '13:00:00', 
 'active'),

-- ========================================
-- DISPENSARY TECHNICIANS TASKS
-- ========================================

('Daily Inventory Count', 
 'Count and verify dispensary inventory levels', 
 ARRAY['dispensary-technicians'], 
 ARRAY['inventory'], 
 ARRAY['every_day'],
 'opening', 
 '08:00:00', 
 'active'),

('Daily Equipment Check', 
 'Check and maintain dispensary equipment', 
 ARRAY['dispensary-technicians'], 
 ARRAY['equipment'], 
 ARRAY['every_day'],
 'opening', 
 '08:15:00', 
 'active'),

('Weekly Stock Rotation', 
 'Rotate stock and check expiry dates', 
 ARRAY['dispensary-technicians'], 
 ARRAY['inventory'], 
 ARRAY['once_weekly'],
 'anytime_during_day', 
 '14:00:00', 
 'active'),

('Monthly Deep Clean', 
 'Deep clean dispensary area and equipment', 
 ARRAY['dispensary-technicians'], 
 ARRAY['maintenance'], 
 ARRAY['start_of_every_month'],
 'closing', 
 '16:00:00', 
 'active'),

-- ========================================
-- DAA PACKERS TASKS
-- ========================================

('Daily DAA Preparation', 
 'Prepare daily dose administration aids', 
 ARRAY['daa-packers'], 
 ARRAY['daa-services'], 
 ARRAY['every_day'],
 'anytime_during_day', 
 '10:00:00', 
 'active'),

('Daily Quality Check', 
 'Quality check completed DAA packs', 
 ARRAY['daa-packers'], 
 ARRAY['quality-control'], 
 ARRAY['every_day'],
 'anytime_during_day', 
 '15:30:00', 
 'active'),

('Weekly DAA Equipment Clean', 
 'Clean and maintain DAA packaging equipment', 
 ARRAY['daa-packers'], 
 ARRAY['equipment'], 
 ARRAY['once_weekly'],
 'closing', 
 '16:45:00', 
 'active'),

('Monthly DAA Audit', 
 'Audit DAA processes and documentation', 
 ARRAY['daa-packers'], 
 ARRAY['compliance'], 
 ARRAY['start_of_every_month'],
 'anytime_during_day', 
 '13:00:00', 
 'active'),

-- ========================================
-- OPERATIONAL/MANAGERIAL TASKS
-- ========================================

('Daily Operations Review', 
 'Review daily operations and staff performance', 
 ARRAY['operational-managerial'], 
 ARRAY['management'], 
 ARRAY['every_day'],
 'closing', 
 '17:00:00', 
 'active'),

('Weekly Staff Meeting', 
 'Conduct weekly staff meeting and briefing', 
 ARRAY['operational-managerial'], 
 ARRAY['management'], 
 ARRAY['once_weekly'],
 'anytime_during_day', 
 '12:00:00', 
 'active'),

('Monthly P&L Review', 
 'Review monthly profit and loss statements', 
 ARRAY['operational-managerial'], 
 ARRAY['financial'], 
 ARRAY['end_of_every_month'],
 'closing', 
 '16:00:00', 
 'active'),

('Monthly Budget Planning', 
 'Plan and review monthly budget allocations', 
 ARRAY['operational-managerial'], 
 ARRAY['financial'], 
 ARRAY['start_of_every_month'],
 'anytime_during_day', 
 '10:30:00', 
 'active'),

-- ========================================
-- MULTI-POSITION TASKS
-- ========================================

('Weekly Fire Safety Check', 
 'Check fire safety equipment and exits', 
 ARRAY['pharmacist-primary', 'operational-managerial'], 
 ARRAY['safety'], 
 ARRAY['once_weekly'],
 'opening', 
 '08:30:00', 
 'active'),

('Monthly Team Training', 
 'Conduct monthly team training session', 
 ARRAY['pharmacist-primary', 'pharmacist-supporting', 'operational-managerial'], 
 ARRAY['training'], 
 ARRAY['start_of_every_month'],
 'anytime_during_day', 
 '14:30:00', 
 'active');

-- Insert sample public holidays for Australia (2024-2025)
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
  ('2025-12-26', 'Boxing Day', 'National', 'data.gov.au')
ON CONFLICT (date, region) DO NOTHING;

-- Insert system settings
INSERT INTO system_settings (key, value, description, data_type, is_public) VALUES
  ('timezone', 'Australia/Sydney', 'Default timezone for the pharmacy', 'string', true),
  ('new_since_hour', '09:00', 'Hour to mark tasks as "new since" for the day', 'string', true),
  ('business_days', '[1,2,3,4,5,6]', 'Business operating days (1=Mon, 2=Tue, etc, 6=Sat)', 'json', true),
  ('workday_start_time', '08:00', 'Standard workday start time', 'string', true),
  ('workday_end_time', '18:00', 'Standard workday end time', 'string', true),
  ('task_generation_enabled', 'true', 'Enable automatic task generation', 'boolean', false),
  ('recurrence_engine_version', '2.0', 'Version of the recurrence engine in use', 'string', false)
ON CONFLICT (key) DO NOTHING;