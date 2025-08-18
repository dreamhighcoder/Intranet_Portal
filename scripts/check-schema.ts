import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

async function checkSchema() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  
  console.log('Checking master_tasks table schema...')
  
  try {
    // Try to query the table structure
    const { data, error } = await supabase
      .from('master_tasks')
      .select('*')
      .limit(1)
    
    if (error) {
      console.error('Error querying master_tasks:', error)
      return
    }
    
    console.log('Successfully queried master_tasks table')
    
    // Try to insert a test record to see what columns are available
    const testData = {
      title: 'Test Task',
      description: 'Test Description',
      position_id: '550e8400-e29b-41d4-a716-446655440001',
      frequency: 'every_day',
      timing: 'Any Time',
      default_due_time: '09:00:00',
      category: 'Test',
      publish_status: 'draft'
    }
    
    console.log('Attempting to insert test record...')
    const { data: insertData, error: insertError } = await supabase
      .from('master_tasks')
      .insert([testData])
      .select()
      .single()
    
    if (insertError) {
      console.error('Insert error:', insertError)
      console.error('Error details:', {
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint,
        code: insertError.code
      })
    } else {
      console.log('Successfully inserted test record:', insertData.id)
      
      // Clean up - delete the test record
      await supabase
        .from('master_tasks')
        .delete()
        .eq('id', insertData.id)
      
      console.log('Test record cleaned up')
    }
    
  } catch (error) {
    console.error('Unexpected error:', error)
  }
}

checkSchema()