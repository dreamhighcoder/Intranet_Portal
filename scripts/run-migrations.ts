import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { readFileSync, readdirSync } from 'fs'
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

async function runMigrations() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  
  console.log('Running database migrations...')
  
  try {
    // Get all migration files
    const migrationsDir = join(process.cwd(), 'supabase', 'migrations')
    const migrationFiles = readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort() // Run migrations in order
    
    console.log(`Found ${migrationFiles.length} migration files:`)
    migrationFiles.forEach(file => console.log(`  - ${file}`))
    
    // Run each migration
    for (const migrationFile of migrationFiles) {
      console.log(`\nRunning migration: ${migrationFile}`)
      
      const migrationPath = join(migrationsDir, migrationFile)
      const migrationSQL = readFileSync(migrationPath, 'utf8')
      
      // Execute the migration SQL
      const { error } = await supabase.rpc('exec_sql', {
        sql: migrationSQL
      })
      
      if (error) {
        console.error(`Error in migration ${migrationFile}:`, error)
        
        // Continue with other migrations even if one fails
        // (some migrations might be idempotent and fail if already applied)
        if (error.message.includes('already exists') || 
            error.message.includes('duplicate key') ||
            error.message.includes('does not exist')) {
          console.log(`  ⚠️  Migration ${migrationFile} skipped (likely already applied)`)
        } else {
          console.log(`  ❌ Migration ${migrationFile} failed`)
        }
      } else {
        console.log(`  ✅ Migration ${migrationFile} completed successfully`)
      }
    }
    
    // Refresh schema cache
    console.log('\nRefreshing schema cache...')
    const { error: refreshError } = await supabase.rpc('exec_sql', {
      sql: "SELECT pg_notify('pgrst', 'reload schema');"
    })
    
    if (refreshError) {
      console.error('Error refreshing schema cache:', refreshError)
    } else {
      console.log('✅ Schema cache refreshed')
    }
    
    // Test the updated schema
    console.log('\nTesting updated schema...')
    
    // Test if the new columns exist
    const { data: columns, error: columnsError } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'master_tasks' 
        AND column_name IN ('responsibility', 'categories', 'frequencies', 'due_time', 'timing')
        ORDER BY column_name;
      `
    })
    
    if (columnsError) {
      console.error('Error checking columns:', columnsError)
    } else {
      console.log('Updated master_tasks columns:')
      if (columns && Array.isArray(columns)) {
        columns.forEach((col: any) => {
          console.log(`  - ${col.column_name}: ${col.data_type}`)
        })
      }
    }
    
    console.log('\n🎉 Migrations completed!')
    console.log('Please wait 10-15 seconds for the schema cache to fully refresh before testing.')
    
  } catch (error) {
    console.error('Unexpected error during migrations:', error)
  }
}

runMigrations()