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

async function fixSchema() {
  console.log('Attempting to fix schema issue...')
  
  try {
    // Try to refresh schema using PostgREST API directly
    const postgrestUrl = supabaseUrl.replace('/rest/v1', '') + '/rest/v1/'
    
    console.log('Sending schema reload request to PostgREST...')
    
    const response = await fetch(postgrestUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        'reload-schema': true
      })
    })
    
    if (response.ok) {
      console.log('Schema reload request sent successfully')
    } else {
      console.log('Schema reload request failed:', response.status, response.statusText)
    }
    
    // Alternative approach: Try to query the information_schema to verify column exists
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    console.log('Checking if default_due_time column exists in database...')
    
    const { data: columns, error: columnError } = await supabase
      .rpc('exec_sql', {
        sql: `
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns 
          WHERE table_name = 'master_tasks' 
          AND table_schema = 'public'
          ORDER BY ordinal_position;
        `
      })
    
    if (columnError) {
      console.log('Cannot query information_schema directly. Trying alternative approach...')
      
      // Try to create the column if it doesn't exist
      console.log('Attempting to ensure default_due_time column exists...')
      
      // Use a simple query that should work if the column exists
      const { data: testData, error: testError } = await supabase
        .from('master_tasks')
        .select('id, title, default_due_time')
        .limit(1)
      
      if (testError) {
        if (testError.message.includes('default_due_time')) {
          console.error('Column definitely does not exist in the schema cache.')
          console.log('\n=== MANUAL FIX REQUIRED ===')
          console.log('Please follow these steps:')
          console.log('1. Go to your Supabase dashboard')
          console.log('2. Navigate to SQL Editor')
          console.log('3. Run this SQL command:')
          console.log('   ALTER TABLE master_tasks ADD COLUMN IF NOT EXISTS default_due_time TIME;')
          console.log('4. Then run this to refresh the schema cache:')
          console.log('   NOTIFY pgrst, \'reload schema\';')
          console.log('5. Wait 10-15 seconds and try creating a master task again')
          console.log('========================\n')
        } else {
          console.error('Different error:', testError)
        }
      } else {
        console.log('Column exists and is accessible!')
        console.log('Schema cache might just need time to refresh. Try again in 10-15 seconds.')
      }
    } else {
      console.log('Successfully queried column information:', columns)
    }
    
  } catch (error) {
    console.error('Error during schema fix:', error)
  }
}

fixSchema()