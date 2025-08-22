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

async function runMigration() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  
  console.log('Running migration: 001_add_master_checklist_and_instances.sql')
  
  try {
    // Read the migration file
    const migrationPath = join(process.cwd(), 'supabase', 'migrations', '001_add_master_checklist_and_instances.sql')
    const migrationSQL = readFileSync(migrationPath, 'utf8')
    
    console.log('Applying migration...')
    
    // Split the migration into smaller chunks to avoid timeout
    const sqlStatements = migrationSQL
      .split(/;\s*(?=\n|$)/)
      .filter(stmt => stmt.trim().length > 0)
      .map(stmt => stmt.trim() + ';')
    
    console.log(`Found ${sqlStatements.length} SQL statements to execute`)
    
    // Execute each statement
    for (let i = 0; i < sqlStatements.length; i++) {
      const statement = sqlStatements[i]
      
      // Skip empty statements and comments
      if (!statement.trim() || statement.trim().startsWith('--')) {
        continue
      }
      
      console.log(`Executing statement ${i + 1}/${sqlStatements.length}...`)
      
      try {
        const { error } = await supabase.rpc('exec_sql', {
          sql: statement
        })
        
        if (error) {
          console.error(`Error in statement ${i + 1}:`, error)
          console.error('Statement:', statement.substring(0, 200) + '...')
          
          // Continue with other statements unless it's a critical error
          if (error.message.includes('already exists') || error.message.includes('does not exist')) {
            console.log('Non-critical error, continuing...')
          } else {
            throw error
          }
        } else {
          console.log(`Statement ${i + 1} executed successfully`)
        }
      } catch (statementError) {
        console.error(`Failed to execute statement ${i + 1}:`, statementError)
        console.error('Statement:', statement.substring(0, 200) + '...')
        // Continue with other statements
      }
    }
    
    console.log('Migration completed!')
    
    // Test the new columns
    console.log('Testing new columns...')
    
    const { data: testQuery, error: testError } = await supabase
      .from('master_tasks')
      .select('id, title, responsibility, categories, frequency_rules, due_time, publish_delay')
      .limit(1)
    
    if (testError) {
      console.error('Error testing new columns:', testError)
      console.log('Some columns may not have been created properly')
    } else {
      console.log('New columns are accessible!')
      console.log('Sample data:', testQuery)
    }
    
    // Test checklist_instances table
    const { data: checklistTest, error: checklistError } = await supabase
      .from('checklist_instances')
      .select('id')
      .limit(1)
    
    if (checklistError) {
      console.error('Error testing checklist_instances table:', checklistError)
    } else {
      console.log('checklist_instances table is accessible!')
    }
    
  } catch (error) {
    console.error('Migration failed:', error)
    process.exit(1)
  }
}

runMigration()