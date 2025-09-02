// Run the position-specific completion migration
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://oabhsaqryrldhqscntck.supabase.co'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9hYmhzYXFyeXJsZGhxc2NudGNrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTA0ODMwOSwiZXhwIjoyMDcwNjI0MzA5fQ.BfMDs-UDzDCxU42ADtU9JuLX18M4N1nBrljpnoUQqwI'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function runMigration() {
  console.log('🚀 Running position-specific completion migration...\n')

  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, 'supabase', 'migrations', '20250115_add_position_specific_completion.sql')
    
    if (!fs.existsSync(migrationPath)) {
      console.error('❌ Migration file not found:', migrationPath)
      return
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')
    console.log('📄 Migration file loaded successfully')
    console.log(`   File size: ${migrationSQL.length} characters`)

    // Split the migration into individual statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--') && !stmt.startsWith('/*'))

    console.log(`\n🔧 Executing ${statements.length} migration statements...\n`)

    let successCount = 0
    let errorCount = 0

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]
      if (statement.trim().length === 0) continue

      console.log(`${i + 1}. Executing statement...`)
      
      try {
        const { error } = await supabase.rpc('exec_sql', { sql: statement })
        
        if (error) {
          console.log(`   ❌ Error: ${error.message}`)
          errorCount++
        } else {
          console.log(`   ✅ Success`)
          successCount++
        }
      } catch (err) {
        console.log(`   ❌ Exception: ${err.message}`)
        errorCount++
      }
    }

    console.log(`\n📊 Migration Results:`)
    console.log(`   ✅ Successful: ${successCount}`)
    console.log(`   ❌ Errors: ${errorCount}`)

    if (errorCount === 0) {
      console.log('\n🎉 Migration completed successfully!')
      console.log('   You can now test the position-specific completion functionality.')
    } else {
      console.log('\n⚠️  Migration completed with errors.')
      console.log('   Please check the errors above and run the remaining statements manually in Supabase Dashboard.')
    }

  } catch (error) {
    console.error('❌ Migration failed:', error)
    console.log('\n💡 Alternative approach:')
    console.log('   1. Go to your Supabase Dashboard')
    console.log('   2. Navigate to SQL Editor')
    console.log('   3. Copy and paste the contents of: supabase/migrations/20250115_add_position_specific_completion.sql')
    console.log('   4. Execute the migration manually')
  }
}

// Alternative: Try using direct SQL execution
async function runMigrationDirect() {
  console.log('🚀 Running migration using direct SQL execution...\n')

  try {
    const migrationPath = path.join(__dirname, 'supabase', 'migrations', '20250115_add_position_specific_completion.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')

    // Try to execute the entire migration as one statement
    const { data, error } = await supabase
      .from('_migration_test')
      .select('*')
      .limit(1)

    // This will fail, but let's try a different approach
    console.log('📋 Please run the migration manually:')
    console.log('   1. Go to https://supabase.com/dashboard/project/oabhsaqryrldhqscntck')
    console.log('   2. Navigate to SQL Editor')
    console.log('   3. Copy the migration content below:')
    console.log('   4. Paste and execute it')
    console.log('\n' + '='.repeat(80))
    console.log(migrationSQL)
    console.log('='.repeat(80))

  } catch (error) {
    console.error('❌ Direct execution failed:', error)
  }
}

// Run the migration
runMigrationDirect()