/**
 * Add Test Tasks Script
 * 
 * This script adds test tasks to the database to verify the checklist functionality.
 * It creates tasks for different responsibilities and with different frequencies.
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import type { Database } from '../types/supabase';

// Load environment variables
dotenv.config();

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

// Test tasks to add
const testTasks = [
  // Pharmacist (Primary) tasks
  {
    title: 'Daily Medication Review',
    description: 'Review all medication orders for the day',
    responsibility: ['pharmacist-primary'],
    categories: ['compliance', 'dispensary-operations'],
    timing: 'opening',
    due_time: '09:30',
    publish_status: 'active',
    frequency: 'every_day',
    frequency_rules: { type: 'daily' }
  },
  {
    title: 'Weekly Controlled Substances Audit',
    description: 'Perform weekly audit of all controlled substances',
    responsibility: ['pharmacist-primary'],
    categories: ['compliance', 'stock-control'],
    timing: 'anytime_during_day',
    due_time: '12:00',
    publish_status: 'active',
    frequency: 'monday',
    frequency_rules: { type: 'weekly', weekday: 1 } // Monday
  },
  
  // Pharmacy Assistants tasks
  {
    title: 'Stock Shelves',
    description: 'Restock shelves with new inventory',
    responsibility: ['pharmacy-assistants'],
    categories: ['stock-control'],
    timing: 'anytime_during_day',
    due_time: '12:00',
    publish_status: 'active',
    frequency: 'every_day',
    frequency_rules: { type: 'daily' }
  },
  {
    title: 'Clean Pharmacy Counter',
    description: 'Clean and sanitize all pharmacy counters',
    responsibility: ['pharmacy-assistants'],
    categories: ['cleaning'],
    timing: 'closing',
    due_time: '17:30',
    publish_status: 'active',
    frequency: 'every_day',
    frequency_rules: { type: 'daily' }
  },
  
  // Dispensary Technicians tasks
  {
    title: 'Prepare Medication Trays',
    description: 'Set up medication trays for the day',
    responsibility: ['dispensary-technicians'],
    categories: ['dispensary-operations'],
    timing: 'opening',
    due_time: '09:30',
    publish_status: 'active',
    frequency: 'every_day',
    frequency_rules: { type: 'daily' }
  },
  
  // DAA Packers tasks
  {
    title: 'Pack Weekly Medication Packs',
    description: 'Prepare dose administration aids for the week',
    responsibility: ['daa-packers'],
    categories: ['pharmacy-services'],
    timing: 'anytime_during_day',
    due_time: '12:00',
    publish_status: 'active',
    frequency: 'monday',
    frequency_rules: { type: 'weekly', weekday: 1 } // Monday
  },
  
  // Shared tasks
  {
    title: 'Staff Meeting',
    description: 'Weekly staff meeting to discuss operations',
    responsibility: ['shared-inc-pharmacist'],
    categories: ['general-pharmacy-operations'],
    timing: 'anytime_during_day',
    due_time: '12:00',
    publish_status: 'active',
    frequency: 'friday',
    frequency_rules: { type: 'weekly', weekday: 5 } // Friday
  },
  {
    title: 'Clean Break Room',
    description: 'Clean and organize the staff break room',
    responsibility: ['shared-exc-pharmacist'],
    categories: ['cleaning'],
    timing: 'closing',
    due_time: '17:30',
    publish_status: 'active',
    frequency: 'friday',
    frequency_rules: { type: 'weekly', weekday: 5 } // Friday
  },
  
  // Operational/Managerial tasks
  {
    title: 'Monthly Inventory Report',
    description: 'Prepare and submit monthly inventory report',
    responsibility: ['operational-managerial'],
    categories: ['business-management', 'stock-control'],
    timing: 'anytime_during_day',
    due_time: '12:00',
    publish_status: 'active',
    frequency: 'end_of_month_jan',
    frequency_rules: { type: 'monthly', position: 'end', months: [1] } // End of January
  }
];

// Add tasks to the database
async function addTestTasks() {
  console.log('Adding test tasks to the database...');
  
  for (const task of testTasks) {
    const { data, error } = await supabase
      .from('master_tasks')
      .insert([{
        title: task.title,
        description: task.description,
        responsibility: task.responsibility,
        categories: task.categories,
        timing: task.timing,
        due_time: task.due_time,
        publish_status: task.publish_status,
        frequency: task.frequency,
        frequency_rules: task.frequency_rules,
        start_date: new Date().toISOString().split('T')[0], // Today
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }]);
    
    if (error) {
      console.error(`Error adding task "${task.title}":`, error);
    } else {
      console.log(`Added task: ${task.title}`);
    }
  }
  
  console.log('Finished adding test tasks.');
}

// Run the script
addTestTasks().catch(console.error);