/**
 * Add a test task directly to the database
 * This script adds a simple test task to the master_tasks table
 */

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client with direct credentials
const supabaseUrl = 'https://your-supabase-url.supabase.co';
const supabaseKey = 'your-supabase-key';

const supabase = createClient(supabaseUrl, supabaseKey);

async function addTestTask() {
  try {
    // Insert a test task
    const { data, error } = await supabase
      .from('master_tasks')
      .insert([
        {
          title: 'Test Task',
          description: 'This is a test task',
          responsibility: ['pharmacist-primary', 'shared-inc-pharmacist'],
          categories: ['compliance', 'dispensary-operations'],
          timing: 'opening',
          due_time: '09:30',
          publish_status: 'active',
          frequency: 'every_day',
          frequency_rules: { type: 'daily' },
          start_date: new Date().toISOString().split('T')[0]
        }
      ]);

    if (error) {
      console.error('Error adding test task:', error);
    } else {
      console.log('Test task added successfully:', data);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

addTestTask();