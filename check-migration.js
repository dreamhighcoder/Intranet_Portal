// Check if migration tables exist
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://oabhsaqryrldhqscntck.supabase.co'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9hYmhzYXFyeXJsZGhxc2NudGNrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTA0ODMwOSwiZXhwIjoyMDcwNjI0MzA5fQ.BfMDs-UDzDCxU42ADtU9JuLX18M4N1nBrljpnoUQqwI'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkMigration() {
  console.log('🔍 Checking migration status...\n')

  try {
    // Test 1: Check if task_position_completions table exists
    console.log('1. Testing task_position_completions table...')
    const { data: completionsTest, error: completionsError } = await supabase
      .from('task_position_completions')
      .select('id')
      .limit(1)

    if (completionsError) {
      console.log('❌ task_position_completions table does not exist')
      console.log('   Error:', completionsError.message)
      console.log('   🚨 MIGRATION NEEDED!')
    } else {
      console.log('✅ task_position_completions table exists')
    }

    // Test 2: Check if new columns exist in task_instances
    console.log('\n2. Testing new columns in task_instances...')
    const { data: instancesTest, error: instancesError } = await supabase
      .from('task_instances')
      .select('id, completed_by_type, position_completions')
      .limit(1)

    if (instancesError) {
      console.log('❌ New columns do not exist in task_instances')
      console.log('   Error:', instancesError.message)
      console.log('   🚨 MIGRATION NEEDED!')
    } else {
      console.log('✅ New columns exist in task_instances')
    }

    // Test 3: Check if view exists
    console.log('\n3. Testing task_completion_status view...')
    const { data: viewTest, error: viewError } = await supabase
      .from('task_completion_status')
      .select('task_instance_id')
      .limit(1)

    if (viewError) {
      console.log('❌ task_completion_status view does not exist')
      console.log('   Error:', viewError.message)
      console.log('   🚨 MIGRATION NEEDED!')
    } else {
      console.log('✅ task_completion_status view exists')
    }

    // Test 4: Test API endpoint
    console.log('\n4. Testing API endpoint...')
    try {
      const response = await fetch(`http://localhost:3001/api/checklist?role=pharmacist-primary&date=2025-01-15&admin_mode=true&responsibility=all`)
      if (response.ok) {
        const data = await response.json()
        console.log('✅ API endpoint working')
        console.log(`   Found ${data.length || 0} tasks`)
        
        // Check if any task has position_completions
        const taskWithCompletions = data.find(task => task.position_completions && task.position_completions.length > 0)
        if (taskWithCompletions) {
          console.log('✅ Position completion data found in API response')
          console.log('   Sample completion:', taskWithCompletions.position_completions[0])
        } else {
          console.log('ℹ️  No position completion data found (expected if no completions exist)')
        }
      } else {
        console.log('❌ API endpoint error:', response.status, response.statusText)
      }
    } catch (apiError) {
      console.log('❌ API endpoint test failed:', apiError.message)
    }

    console.log('\n📋 Summary:')
    if (completionsError || instancesError || viewError) {
      console.log('🚨 MIGRATION REQUIRED!')
      console.log('   Please run the migration in your Supabase dashboard:')
      console.log('   1. Go to Supabase Dashboard > SQL Editor')
      console.log('   2. Copy and paste the contents of: supabase/migrations/20250115_add_position_specific_completion.sql')
      console.log('   3. Execute the migration')
    } else {
      console.log('✅ Migration appears to be complete!')
      console.log('   If you\'re still seeing issues, check:')
      console.log('   - Browser console for JavaScript errors')
      console.log('   - Network tab for API call failures')
      console.log('   - Server logs for backend errors')
    }

  } catch (error) {
    console.error('❌ Check failed:', error)
  }
}

checkMigration()