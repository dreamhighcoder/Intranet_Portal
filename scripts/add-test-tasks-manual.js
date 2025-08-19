/**
 * Add test tasks directly to the database
 * This script adds test tasks with the correct structure for testing
 */

// This is a script you can run in the Supabase SQL Editor
// or adapt to use with the Supabase JavaScript client

const testTasks = [
  // Task for Pharmacist (Primary)
  {
    title: 'Daily Medication Review',
    description: 'Review all medication orders for the day',
    responsibility: ['pharmacist-primary'],
    categories: ['compliance', 'dispensary-operations'],
    timing: 'opening',
    due_time: '09:30:00',
    publish_status: 'active',
    frequency: 'every_day',
    frequency_rules: { type: 'daily' }
  },
  
  // Task for Pharmacy Assistants
  {
    title: 'Stock Shelves',
    description: 'Restock shelves with new inventory',
    responsibility: ['pharmacy-assistants'],
    categories: ['stock-control'],
    timing: 'anytime_during_day',
    due_time: '12:00:00',
    publish_status: 'active',
    frequency: 'every_day',
    frequency_rules: { type: 'daily' }
  },
  
  // Task for Dispensary Technicians
  {
    title: 'Prepare Medication Trays',
    description: 'Set up medication trays for the day',
    responsibility: ['dispensary-technicians'],
    categories: ['dispensary-operations'],
    timing: 'opening',
    due_time: '09:30:00',
    publish_status: 'active',
    frequency: 'every_day',
    frequency_rules: { type: 'daily' }
  },
  
  // Task for DAA Packers
  {
    title: 'Pack Weekly Medication Packs',
    description: 'Prepare dose administration aids for the week',
    responsibility: ['daa-packers'],
    categories: ['pharmacy-services'],
    timing: 'anytime_during_day',
    due_time: '12:00:00',
    publish_status: 'active',
    frequency: 'every_day',
    frequency_rules: { type: 'daily' }
  },
  
  // Task for Shared (inc. Pharmacist)
  {
    title: 'Staff Meeting',
    description: 'Weekly staff meeting to discuss operations',
    responsibility: ['shared-inc-pharmacist'],
    categories: ['general-pharmacy-operations'],
    timing: 'anytime_during_day',
    due_time: '12:00:00',
    publish_status: 'active',
    frequency: 'every_day',
    frequency_rules: { type: 'daily' }
  },
  
  // Task for Shared (exc. Pharmacist)
  {
    title: 'Clean Break Room',
    description: 'Clean and organize the staff break room',
    responsibility: ['shared-exc-pharmacist'],
    categories: ['cleaning'],
    timing: 'closing',
    due_time: '17:30:00',
    publish_status: 'active',
    frequency: 'every_day',
    frequency_rules: { type: 'daily' }
  }
];

// SQL to insert the tasks
const insertSQL = testTasks.map(task => {
  return `
INSERT INTO master_tasks (
  title,
  description,
  responsibility,
  categories,
  timing,
  due_time,
  publish_status,
  frequency,
  frequency_rules,
  start_date,
  created_at,
  updated_at
) VALUES (
  '${task.title}',
  '${task.description}',
  '${JSON.stringify(task.responsibility)}'::jsonb,
  '${JSON.stringify(task.categories)}'::jsonb,
  '${task.timing}',
  '${task.due_time}',
  '${task.publish_status}',
  '${task.frequency}',
  '${JSON.stringify(task.frequency_rules)}'::jsonb,
  CURRENT_DATE,
  NOW(),
  NOW()
);
  `;
}).join('\n');

console.log('SQL to run in Supabase SQL Editor:');
console.log(insertSQL);