import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { readFileSync } from 'fs'
import { join } from 'path'

// Load environment variables
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables')
  console.error('Make sure you have NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env.local file')
  process.exit(1)
}

async function setupDatabase() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  
  console.log('Setting up database schema...')
  
  try {
    // Read the schema file
    const schemaPath = join(process.cwd(), 'supabase', 'schema.sql')
    const schemaSQL = readFileSync(schemaPath, 'utf8')
    
    console.log('Applying database schema...')
    
    // Execute the schema SQL
    const { error: schemaError } = await supabase.rpc('exec_sql', {
      sql: schemaSQL
    })
    
    if (schemaError) {
      console.error('Error applying schema:', schemaError)
      
      // Try alternative approach - execute schema in parts
      console.log('Trying alternative approach...')
      
      // First, ensure the master_tasks table has the correct structure
      const alterTableSQL = `
        -- Add default_due_time column if it doesn't exist
        ALTER TABLE master_tasks 
        ADD COLUMN IF NOT EXISTS default_due_time TIME;
        
        -- Refresh the schema cache
        NOTIFY pgrst, 'reload schema';
      `
      
      const { error: alterError } = await supabase.rpc('exec_sql', {
        sql: alterTableSQL
      })
      
      if (alterError) {
        console.error('Error altering table:', alterError)
        
        // Try direct SQL execution
        console.log('Trying direct SQL execution...')
        
        // Use raw SQL query
        const { error: rawError } = await supabase
          .from('master_tasks')
          .select('default_due_time')
          .limit(1)
        
        if (rawError && rawError.message.includes('default_due_time')) {
          console.error('Column definitely missing. Manual intervention required.')
          console.log('Please run the following SQL in your Supabase SQL editor:')
          console.log('ALTER TABLE master_tasks ADD COLUMN IF NOT EXISTS default_due_time TIME;')
          console.log('Then run: SELECT pg_notify(\'pgrst\', \'reload schema\');')
          return
        }
      } else {
        console.log('Successfully applied schema alterations')
      }
    } else {
      console.log('Successfully applied complete schema')
    }
    
    // Test the schema
    console.log('Testing schema...')
    
    // Get a valid position ID from the database for testing
    const { data: positions, error: positionError } = await supabase
      .from('positions')
      .select('id')
      .neq('name', 'Administrator')
      .limit(1)
    
    if (positionError || !positions || positions.length === 0) {
      console.error('Could not find a valid position for testing:', positionError)
      return
    }
    
    const testData = {
      title: 'Schema Test Task',
      description: 'Testing schema setup',
      position_id: positions[0].id,
      frequency: 'every_day',
      timing: 'Any Time',
      default_due_time: '09:00:00',
      category: 'Test',
      publish_status: 'draft'
    }
    
    const { data: testResult, error: testError } = await supabase
      .from('master_tasks')
      .insert([testData])
      .select()
      .single()
    
    if (testError) {
      console.error('Schema test failed:', testError)
      
      if (testError.code === 'PGRST204') {
        console.log('Schema cache issue detected. Attempting to refresh...')
        
        // Try to refresh schema cache
        const { error: refreshError } = await supabase.rpc('exec_sql', {
          sql: "SELECT pg_notify('pgrst', 'reload schema');"
        })
        
        if (refreshError) {
          console.error('Could not refresh schema cache:', refreshError)
          console.log('Manual intervention required:')
          console.log('1. Go to your Supabase dashboard')
          console.log('2. Go to SQL Editor')
          console.log('3. Run: SELECT pg_notify(\'pgrst\', \'reload schema\');')
          console.log('4. Wait a few seconds and try creating a master task again')
        } else {
          console.log('Schema cache refresh initiated. Please wait 10-15 seconds before trying again.')
        }
      }
    } else {
      console.log('Schema test successful! Task created with ID:', testResult.id)
      
      // Clean up test record
      await supabase
        .from('master_tasks')
        .delete()
        .eq('id', testResult.id)
      
      console.log('Test record cleaned up')
      console.log('Database setup complete!')
    }
    
  } catch (error) {
    console.error('Unexpected error during database setup:', error)
  }
}

// Also create a function to just refresh the schema cache
async function refreshSchemaCache() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  
  console.log('Refreshing schema cache...')
  
  try {
    const { error } = await supabase.rpc('exec_sql', {
      sql: "SELECT pg_notify('pgrst', 'reload schema');"
    })
    
    if (error) {
      console.error('Error refreshing schema cache:', error)
    } else {
      console.log('Schema cache refresh initiated. Please wait 10-15 seconds.')
    }
  } catch (error) {
    console.error('Unexpected error:', error)
  }
}

// Check command line arguments
const command = process.argv[2]

if (command === 'refresh') {
  refreshSchemaCache()
} else {
  setupDatabase()
}