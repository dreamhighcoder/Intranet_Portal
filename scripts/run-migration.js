const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables:')
  console.error('NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl)
  console.error('SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey)
  process.exit(1)
}

async function runMigration() {
  console.log('🚀 Starting database migration...')
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  
  try {
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, 'apply-schema-updates.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')
    
    console.log('📖 Read migration file:', migrationPath)
    
    // Split the SQL into individual statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))
    
    console.log(`📝 Found ${statements.length} SQL statements to execute`)
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]
      if (statement.trim()) {
        console.log(`\n⚡ Executing statement ${i + 1}/${statements.length}:`)
        console.log(statement.substring(0, 100) + (statement.length > 100 ? '...' : ''))
        
        const { error } = await supabase.rpc('exec_sql', { sql: statement })
        
        if (error) {
          console.error(`❌ Error in statement ${i + 1}:`, error.message)
          // Continue with other statements for non-critical errors
          if (error.message.includes('already exists') || error.message.includes('does not exist')) {
            console.log('⚠️  Non-critical error, continuing...')
          } else {
            throw error
          }
        } else {
          console.log('✅ Statement executed successfully')
        }
      }
    }
    
    console.log('\n🎉 Migration completed successfully!')
    
    // Verify the migration by checking if the new columns exist
    console.log('\n🔍 Verifying migration...')
    const { data, error } = await supabase
      .from('master_tasks')
      .select('id, title, responsibility, categories')
      .limit(1)
    
    if (error) {
      console.error('❌ Verification failed:', error.message)
    } else {
      console.log('✅ Migration verified - new columns are accessible')
      if (data && data.length > 0) {
        console.log('📊 Sample record:', {
          id: data[0].id,
          title: data[0].title,
          hasResponsibility: Array.isArray(data[0].responsibility),
          hasCategories: Array.isArray(data[0].categories)
        })
      }
    }
    
  } catch (error) {
    console.error('💥 Migration failed:', error.message)
    process.exit(1)
  }
}

// Alternative approach using direct SQL execution
async function runMigrationDirect() {
  console.log('🚀 Starting database migration (direct SQL approach)...')
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  
  try {
    // Execute each migration step individually
    const steps = [
      {
        name: 'Add responsibility column',
        sql: `ALTER TABLE master_tasks ADD COLUMN IF NOT EXISTS responsibility TEXT[] DEFAULT '{}'`
      },
      {
        name: 'Add categories column',
        sql: `ALTER TABLE master_tasks ADD COLUMN IF NOT EXISTS categories TEXT[] DEFAULT '{}'`
      },
      {
        name: 'Add due_date column',
        sql: `ALTER TABLE master_tasks ADD COLUMN IF NOT EXISTS due_date DATE`
      },
      {
        name: 'Add due_time column',
        sql: `ALTER TABLE master_tasks ADD COLUMN IF NOT EXISTS due_time TIME`
      },
      {
        name: 'Add publish_delay column',
        sql: `ALTER TABLE master_tasks ADD COLUMN IF NOT EXISTS publish_delay DATE`
      },
      {
        name: 'Create responsibility index',
        sql: `CREATE INDEX IF NOT EXISTS idx_master_tasks_responsibility ON master_tasks USING GIN(responsibility)`
      },
      {
        name: 'Create categories index',
        sql: `CREATE INDEX IF NOT EXISTS idx_master_tasks_categories ON master_tasks USING GIN(categories)`
      },
      {
        name: 'Migrate existing categories',
        sql: `UPDATE master_tasks SET categories = ARRAY[category] WHERE category IS NOT NULL AND (categories IS NULL OR categories = '{}')`
      },
      {
        name: 'Set default timing',
        sql: `UPDATE master_tasks SET timing = 'opening' WHERE timing IS NULL`
      },
      {
        name: 'Migrate responsibility from position_id',
        sql: `UPDATE master_tasks SET responsibility = CASE 
          WHEN position_id = '550e8400-e29b-41d4-a716-446655440001' THEN ARRAY['pharmacist-primary']
          WHEN position_id = '550e8400-e29b-41d4-a716-446655440002' THEN ARRAY['pharmacist-supporting']
          WHEN position_id = '550e8400-e29b-41d4-a716-446655440003' THEN ARRAY['pharmacy-assistants']
          WHEN position_id = '550e8400-e29b-41d4-a716-446655440004' THEN ARRAY['dispensary-technicians']
          WHEN position_id = '550e8400-e29b-41d4-a716-446655440005' THEN ARRAY['daa-packers']
          WHEN position_id = '550e8400-e29b-41d4-a716-446655440006' THEN ARRAY['operational-managerial']
          ELSE ARRAY['pharmacy-assistants']
        END WHERE responsibility IS NULL OR responsibility = '{}'`
      }
    ]
    
    for (const step of steps) {
      console.log(`\n⚡ ${step.name}...`)
      
      const { error } = await supabase.rpc('exec_sql', { sql: step.sql })
      
      if (error) {
        console.error(`❌ Error in ${step.name}:`, error.message)
        if (error.message.includes('already exists') || error.message.includes('does not exist')) {
          console.log('⚠️  Non-critical error, continuing...')
        } else {
          throw error
        }
      } else {
        console.log(`✅ ${step.name} completed`)
      }
    }
    
    console.log('\n🎉 Migration completed successfully!')
    
    // Verify the migration
    console.log('\n🔍 Verifying migration...')
    const { data, error } = await supabase
      .from('master_tasks')
      .select('id, title, responsibility, categories, timing')
      .limit(1)
    
    if (error) {
      console.error('❌ Verification failed:', error.message)
    } else {
      console.log('✅ Migration verified - new columns are accessible')
      if (data && data.length > 0) {
        console.log('📊 Sample record:', {
          id: data[0].id,
          title: data[0].title,
          responsibility: data[0].responsibility,
          categories: data[0].categories,
          timing: data[0].timing
        })
      }
    }
    
  } catch (error) {
    console.error('💥 Migration failed:', error.message)
    process.exit(1)
  }
}

// Run the migration
runMigrationDirect()