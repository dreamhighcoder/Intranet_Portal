import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
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
      ])
      .select();

    if (error) {
      console.error('Error adding test task:', error);
      return NextResponse.json({ success: false, error }, { status: 500 });
    } else {
      console.log('Test task added successfully:', data);
      return NextResponse.json({ success: true, data });
    }
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ success: false, error }, { status: 500 });
  }
}