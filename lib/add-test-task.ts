/**
 * Add a test task directly to the database
 * This is a utility function to add a test task for debugging
 */

import { supabase } from './supabase';

export async function addTestTask() {
  try {
    // Insert a test task for all roles
    const { data, error } = await supabase
      .from('master_tasks')
      .insert([
        {
          title: 'Test Task',
          description: 'This is a test task',
          responsibility: ['pharmacist-primary', 'pharmacy-assistants', 'dispensary-technicians', 'daa-packers', 'operational-managerial'],
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
      return { success: false, error };
    } else {
      console.log('Test task added successfully:', data);
      return { success: true, data };
    }
  } catch (error) {
    console.error('Error:', error);
    return { success: false, error };
  }
}