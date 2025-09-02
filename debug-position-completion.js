// Debug position-specific completion functionality
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://oabhsaqryrldhqscntck.supabase.co'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9hYmhzYXFyeXJsZGhxc2NudGNrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTA0ODMwOSwiZXhwIjoyMDcwNjI0MzA5fQ.BfMDs-UDzDCxU42ADtU9JuLX18M4N1nBrljpnoUQqwI'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function debugPositionCompletion() {
  console.log('🔍 Debugging position-specific completion...\n')

  try {
    // 1. Check if we have any positions
    console.log('1. Checking positions...')
    const { data: positions, error: positionsError } = await supabase
      .from('positions')
      .select('id, name')
      .limit(5)

    if (positionsError) {
      console.log('❌ Error fetching positions:', positionsError.message)
      return
    }

    console.log(`✅ Found ${positions.length} positions:`)
    positions.forEach(pos => console.log(`   - ${pos.name} (${pos.id})`))

    // 2. Check if we have any master tasks
    console.log('\n2. Checking master tasks...')
    const { data: masterTasks, error: masterTasksError } = await supabase
      .from('master_tasks')
      .select('id, title, responsibility, publish_status')
      .eq('publish_status', 'active')
      .limit(3)

    if (masterTasksError) {
      console.log('❌ Error fetching master tasks:', masterTasksError.message)
      return
    }

    console.log(`✅ Found ${masterTasks.length} active master tasks:`)
    masterTasks.forEach(task => console.log(`   - ${task.title} (${task.responsibility})`))

    // 3. Check if we have any task instances
    console.log('\n3. Checking task instances...')
    const { data: taskInstances, error: instancesError } = await supabase
      .from('task_instances')
      .select('id, master_task_id, instance_date, status')
      .eq('instance_date', '2025-01-15')
      .limit(5)

    if (instancesError) {
      console.log('❌ Error fetching task instances:', instancesError.message)
      return
    }

    console.log(`✅ Found ${taskInstances.length} task instances for today:`)
    taskInstances.forEach(instance => console.log(`   - Instance ${instance.id} (status: ${instance.status})`))

    // 4. Check if we have any position completions
    console.log('\n4. Checking position completions...')
    const { data: completions, error: completionsError } = await supabase
      .from('task_position_completions')
      .select('*')
      .limit(10)

    if (completionsError) {
      console.log('❌ Error fetching position completions:', completionsError.message)
      return
    }

    console.log(`✅ Found ${completions.length} position completions:`)
    completions.forEach(comp => console.log(`   - ${comp.position_name} completed task ${comp.task_instance_id} at ${comp.completed_at}`))

    // 5. Test the API endpoint directly
    console.log('\n5. Testing checklist API...')
    try {
      const response = await fetch('http://localhost:3001/api/checklist?role=pharmacist-primary&date=2025-01-15&admin_mode=true&responsibility=all')
      
      if (!response.ok) {
        console.log(`❌ API returned status: ${response.status}`)
        const errorText = await response.text()
        console.log(`   Error: ${errorText}`)
        return
      }

      const apiData = await response.json()
      console.log(`✅ API returned ${apiData.length} tasks`)

      // Check if any tasks have position_completions
      const tasksWithCompletions = apiData.filter(task => task.position_completions && task.position_completions.length > 0)
      console.log(`   Tasks with position completions: ${tasksWithCompletions.length}`)

      if (tasksWithCompletions.length > 0) {
        console.log('   Sample task with completions:')
        const sample = tasksWithCompletions[0]
        console.log(`     - Title: ${sample.master_task?.title}`)
        console.log(`     - Status: ${sample.status}`)
        console.log(`     - Position completions: ${JSON.stringify(sample.position_completions, null, 2)}`)
      }

      // Check tasks without completions
      const tasksWithoutCompletions = apiData.filter(task => !task.position_completions || task.position_completions.length === 0)
      console.log(`   Tasks without position completions: ${tasksWithoutCompletions.length}`)

      if (tasksWithoutCompletions.length > 0) {
        console.log('   Sample task without completions:')
        const sample = tasksWithoutCompletions[0]
        console.log(`     - Title: ${sample.master_task?.title}`)
        console.log(`     - Status: ${sample.status}`)
        console.log(`     - Instance ID: ${sample.instance_id}`)
      }

    } catch (apiError) {
      console.log('❌ API test failed:', apiError.message)
    }

    // 6. Create a test completion if none exist
    if (completions.length === 0 && taskInstances.length > 0 && positions.length > 0) {
      console.log('\n6. Creating test completion...')
      
      const testInstance = taskInstances[0]
      const testPosition = positions[0]
      
      const { data: testCompletion, error: testError } = await supabase
        .from('task_position_completions')
        .insert({
          task_instance_id: testInstance.id,
          position_id: testPosition.id,
          position_name: testPosition.name,
          completed_by: null, // We don't have a real user ID
          completed_at: new Date().toISOString(),
          is_completed: true
        })
        .select()

      if (testError) {
        console.log('❌ Error creating test completion:', testError.message)
      } else {
        console.log('✅ Created test completion')
        console.log('   Now try refreshing your browser and checking the admin view')
      }
    }

  } catch (error) {
    console.error('❌ Debug failed:', error)
  }
}

debugPositionCompletion()