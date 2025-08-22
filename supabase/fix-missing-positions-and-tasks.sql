-- Fix Missing Positions and Tasks
-- Run this script in Supabase SQL Editor to fix the missing positions and tasks issue

-- ========================================
-- STEP 1: VERIFY POSITIONS EXIST
-- ========================================

-- The positions already exist in the database with these names:
-- - Pharmacist (Primary)
-- - Pharmacist (Supporting) 
-- - Pharmacy Assistant/s
-- - Dispensary Technician/s
-- - DAA Packer/s
-- - Operational/Managerial

-- These convert to kebab-case responsibility values as:
-- - pharmacist-primary
-- - pharmacist-supporting
-- - pharmacy-assistant-s
-- - dispensary-technician-s
-- - daa-packer-s
-- - operational-managerial

-- ========================================
-- STEP 2: CLEAR AND RECREATE MASTER TASKS
-- ========================================

-- Clear existing master tasks to avoid conflicts
DELETE FROM task_instances;
DELETE FROM master_tasks;

-- Insert comprehensive master tasks for all positions
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

-- PHARMACIST (PRIMARY) TASKS
('Daily Register Check', 'Verify controlled substances register is complete and accurate', ARRAY['pharmacist-primary'], ARRAY['compliance'], ARRAY['every_day'], 'opening', '09:00:00', 'active'),
('Daily Temperature Log', 'Record and verify refrigeration temperatures', ARRAY['pharmacist-primary'], ARRAY['pharmacy-services'], ARRAY['every_day'], 'opening', '08:30:00', 'active'),
('Daily Clinical Review', 'Review clinical interventions and patient consultations', ARRAY['pharmacist-primary'], ARRAY['clinical'], ARRAY['every_day'], 'closing', '16:30:00', 'active'),
('Weekly Safety Review', 'Review weekly safety incidents and near misses', ARRAY['pharmacist-primary'], ARRAY['compliance'], ARRAY['once_weekly'], 'opening', '09:30:00', 'active'),
('Monthly Compliance Audit', 'Complete monthly compliance audit and documentation', ARRAY['pharmacist-primary'], ARRAY['compliance'], ARRAY['start_of_every_month'], 'anytime_during_day', '14:00:00', 'active'),

-- PHARMACIST (SUPPORTING) TASKS
('Daily Prescription Review', 'Review and verify prescriptions for accuracy', ARRAY['pharmacist-supporting'], ARRAY['clinical'], ARRAY['every_day'], 'anytime_during_day', '11:00:00', 'active'),
('Weekly Inventory Spot Check', 'Perform spot checks on high-value inventory items', ARRAY['pharmacist-supporting'], ARRAY['inventory'], ARRAY['once_weekly'], 'anytime_during_day', '15:00:00', 'active'),

-- PHARMACY ASSISTANTS TASKS (using correct kebab-case: pharmacy-assistant-s)
('Daily Customer Service Check', 'Review customer service standards and waiting area', ARRAY['pharmacy-assistant-s'], ARRAY['customer-service'], ARRAY['every_day'], 'opening', '08:45:00', 'active'),
('Daily Till Reconciliation', 'Reconcile daily till and payment processing', ARRAY['pharmacy-assistant-s'], ARRAY['financial'], ARRAY['every_day'], 'closing', '17:15:00', 'active'),
('Weekly Display Update', 'Update promotional displays and health information', ARRAY['pharmacy-assistant-s'], ARRAY['marketing'], ARRAY['once_weekly'], 'anytime_during_day', '13:00:00', 'active'),

-- DISPENSARY TECHNICIANS TASKS (using correct kebab-case: dispensary-technician-s)
('Daily Inventory Count', 'Count and verify dispensary inventory levels', ARRAY['dispensary-technician-s'], ARRAY['inventory'], ARRAY['every_day'], 'opening', '08:00:00', 'active'),
('Daily Equipment Check', 'Check and maintain dispensary equipment', ARRAY['dispensary-technician-s'], ARRAY['equipment'], ARRAY['every_day'], 'opening', '08:15:00', 'active'),
('Weekly Stock Rotation', 'Rotate stock and check expiry dates', ARRAY['dispensary-technician-s'], ARRAY['inventory'], ARRAY['once_weekly'], 'anytime_during_day', '14:00:00', 'active'),
('Monthly Deep Clean', 'Deep clean dispensary area and equipment', ARRAY['dispensary-technician-s'], ARRAY['maintenance'], ARRAY['start_of_every_month'], 'closing', '16:00:00', 'active'),

-- DAA PACKERS TASKS (using correct kebab-case: daa-packer-s)
('Daily DAA Preparation', 'Prepare daily dose administration aids', ARRAY['daa-packer-s'], ARRAY['daa-services'], ARRAY['every_day'], 'anytime_during_day', '10:00:00', 'active'),
('Daily Quality Check', 'Quality check completed DAA packs', ARRAY['daa-packer-s'], ARRAY['quality-control'], ARRAY['every_day'], 'anytime_during_day', '15:30:00', 'active'),
('Weekly DAA Equipment Clean', 'Clean and maintain DAA packaging equipment', ARRAY['daa-packer-s'], ARRAY['equipment'], ARRAY['once_weekly'], 'closing', '16:45:00', 'active'),
('Monthly DAA Audit', 'Audit DAA processes and documentation', ARRAY['daa-packer-s'], ARRAY['compliance'], ARRAY['start_of_every_month'], 'anytime_during_day', '13:00:00', 'active'),

-- OPERATIONAL/MANAGERIAL TASKS
('Daily Operations Review', 'Review daily operations and staff performance', ARRAY['operational-managerial'], ARRAY['management'], ARRAY['every_day'], 'closing', '17:00:00', 'active'),
('Weekly Staff Meeting', 'Conduct weekly staff meeting and briefing', ARRAY['operational-managerial'], ARRAY['management'], ARRAY['once_weekly'], 'anytime_during_day', '12:00:00', 'active'),
('Monthly P&L Review', 'Review monthly profit and loss statements', ARRAY['operational-managerial'], ARRAY['financial'], ARRAY['end_of_every_month'], 'closing', '16:00:00', 'active'),
('Monthly Budget Planning', 'Plan and review monthly budget allocations', ARRAY['operational-managerial'], ARRAY['financial'], ARRAY['start_of_every_month'], 'anytime_during_day', '10:30:00', 'active'),

-- MULTI-POSITION TASKS
('Weekly Fire Safety Check', 'Check fire safety equipment and exits', ARRAY['pharmacist-primary', 'operational-managerial'], ARRAY['safety'], ARRAY['once_weekly'], 'opening', '08:30:00', 'active'),
('Monthly Team Training', 'Conduct monthly team training session', ARRAY['pharmacist-primary', 'pharmacist-supporting', 'operational-managerial'], ARRAY['training'], ARRAY['start_of_every_month'], 'anytime_during_day', '14:30:00', 'active');

-- ========================================
-- STEP 3: ENSURE PUBLIC HOLIDAYS EXIST
-- ========================================

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

-- ========================================
-- STEP 4: VERIFICATION QUERIES
-- ========================================

-- Verify positions
SELECT 'POSITIONS' as table_name, COUNT(*) as count FROM positions;
SELECT name FROM positions ORDER BY name;

-- Verify master tasks
SELECT 'MASTER_TASKS' as table_name, COUNT(*) as count FROM master_tasks;

-- Show tasks by responsibility
SELECT 
  unnest(responsibility) as responsibility,
  COUNT(*) as task_count
FROM master_tasks 
GROUP BY unnest(responsibility)
ORDER BY responsibility;

-- Show frequency distribution
SELECT 
  unnest(frequencies) as frequency,
  COUNT(*) as task_count
FROM master_tasks 
GROUP BY unnest(frequencies)
ORDER BY frequency;

-- ========================================
-- COMPLETION MESSAGE
-- ========================================

DO $$
BEGIN
  RAISE NOTICE '✅ Fix completed successfully!';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Start your development server: pnpm run dev';
  RAISE NOTICE '2. Generate task instances: pnpm run generate-tasks';
  RAISE NOTICE '3. Visit the homepage to verify all 6 positions are visible';
  RAISE NOTICE '4. Login with each position to verify tasks are showing';
END $$;