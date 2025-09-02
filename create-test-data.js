// Create test data for position-specific completion testing
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://oabhsaqryrldhqscntck.supabase.co'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9hYmhzYXFyeXJsZGhxc2NudGNrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTA0ODMwOSwiZXhwIjoyMDcwNjI0MzA5fQ.BfMDs-UDzDCxU42ADtU9JuLX18M4N1nBrljpnoUQqwI'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function createTestData() {
  console.log('🚀 Creating test data for position-specific completion...\n')

  try {
    // 1. Get positions
    const { data: positions, error: positionsError } = await supabase
      .from('positions')
      .select('id, name')

    if (positionsError) {
      console.log('❌ Error fetching positions:', positionsError.message)
      return
    }

    console.log(`✅ Found ${positions.length} positions`)

    // 2. Create a test master task if none exist with proper titles
    console.log('\n2. Creating test master task...')
    
    const { data: existingTask, error: checkError } = await supabase
      .from('master_tasks')
      .select('id, title')
      .eq('title', 'Test Shared Task for Position Completion')
      .maybeSingle()

    let masterTaskId
    
    if (existingTask) {
      console.log('✅ Test master task already exists')
      masterTaskId = existingTask.id
    } else {
      const { data: newTask, error: createError } = await supabase
        .from('master_tasks')
        .insert({
          title: 'Test Shared Task for Position Completion',
          description: 'This is a test task to verify position-specific completion functionality',
          responsibility: ['pharmacy-assistant', 'dispensary-technician', 'daa-packer'],
          timing: 'opening',
          due_time: '10:00:00',
          frequencies: ['every_day'],
          publish_status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single()

      if (createError) {
        console.log('❌ Error creating master task:', createError.message)
        return
      }

      masterTaskId = newTask.id
      console.log('✅ Created test master task:', masterTaskId)
    }

    // 3. Create a task instance for today
    console.log('\n3. Creating task instance for today...')
    
    const today = '2025-01-15'
    
    const { data: existingInstance, error: instanceCheckError } = await supabase
      .from('task_instances')
      .select('id')
      .eq('master_task_id', masterTaskId)
      .eq('instance_date', today)
      .maybeSingle()

    let instanceId
    
    if (existingInstance) {
      console.log('✅ Task instance already exists')
      instanceId = existingInstance.id
    } else {
      const { data: newInstance, error: instanceCreateError } = await supabase
        .from('task_instances')
        .insert({
          master_task_id: masterTaskId,
          instance_date: today,
          due_date: today,
          status: 'due_today',
          is_published: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single()

      if (instanceCreateError) {
        console.log('❌ Error creating task instance:', instanceCreateError.message)
        return
      }

      instanceId = newInstance.id
      console.log('✅ Created task instance:', instanceId)
    }

    // 4. Create position completions for testing
    console.log('\n4. Creating test position completions...')
    
    // Find pharmacy assistant and dispensary technician positions
    const pharmacyAssistant = positions.find(p => p.name === 'Pharmacy Assistant')
    const dispensaryTech = positions.find(p => p.name === 'Dispensary Technician')
    
    if (pharmacyAssistant) {
      // Check if completion already exists
      const { data: existingCompletion } = await supabase
        .from('task_position_completions')
        .select('id')
        .eq('task_instance_id', instanceId)
        .eq('position_id', pharmacyAssistant.id)
        .maybeSingle()

      if (!existingCompletion) {
        const { error: completionError } = await supabase
          .from('task_position_completions')
          .insert({
            task_instance_id: instanceId,
            position_id: pharmacyAssistant.id,
            position_name: pharmacyAssistant.name,
            completed_by: null,
            completed_at: new Date().toISOString(),
            is_completed: true
          })

        if (completionError) {
          console.log('❌ Error creating pharmacy assistant completion:', completionError.message)
        } else {
          console.log('✅ Created completion for Pharmacy Assistant')
        }
      } else {
        console.log('✅ Pharmacy Assistant completion already exists')
      }
    }

    if (dispensaryTech) {
      // Check if completion already exists
      const { data: existingCompletion } = await supabase
        .from('task_position_completions')
        .select('id')
        .eq('task_instance_id', instanceId)
        .eq('position_id', dispensaryTech.id)
        .maybeSingle()

      if (!existingCompletion) {
        const { error: completionError } = await supabase
          .from('task_position_completions')
          .insert({
            task_instance_id: instanceId,
            position_id: dispensaryTech.id,
            position_name: dispensaryTech.name,
            completed_by: null,
            completed_at: new Date().toISOString(),
            is_completed: true
          })

        if (completionError) {
          console.log('❌ Error creating dispensary tech completion:', completionError.message)
        } else {
          console.log('✅ Created completion for Dispensary Technician')
        }
      } else {
        console.log('✅ Dispensary Technician completion already exists')
      }
    }

    // 5. Test the API now
    console.log('\n5. Testing API with test data...')
    
    try {
      const response = await fetch('http://localhost:3001/api/checklist?role=administrator&date=2025-01-15&admin_mode=true&responsibility=all')
      
      if (!response.ok) {
        console.log(`❌ API returned status: ${response.status}`)
        const errorText = await response.text()
        console.log(`   Error: ${errorText}`)
        return
      }

      const apiData = await response.json()
      console.log(`✅ API returned ${apiData.length} tasks`)

      // Find our test task
      const testTask = apiData.find(task => task.master_task?.title === 'Test Shared Task for Position Completion')
      
      if (testTask) {
        console.log('\n✅ Found test task in API response:')
        console.log(`   - Title: ${testTask.master_task.title}`)
        console.log(`   - Status: ${testTask.status}`)
        console.log(`   - Position completions: ${JSON.stringify(testTask.position_completions, null, 2)}`)
        console.log(`   - Is completed for position: ${testTask.is_completed_for_position}`)
        
        if (testTask.position_completions && testTask.position_completions.length > 0) {
          console.log('\n🎉 SUCCESS! Position completion data is working!')
          console.log('   Now check your admin view - you should see position badges instead of "Due Today"')
        } else {
          console.log('\n❌ Position completion data is not being returned by API')
        }
      } else {
        console.log('\n❌ Test task not found in API response')
        console.log('   Available tasks:')
        apiData.forEach(task => console.log(`     - ${task.master_task?.title || 'No title'}`))
      }

    } catch (apiError) {
      console.log('❌ API test failed:', apiError.message)
    }

    console.log('\n📋 Test data creation complete!')
    console.log('   1. Refresh your browser')
    console.log('   2. Login as Administrator')
    console.log('   3. Go to checklist page')
    console.log('   4. Set filter to "All Responsibilities"')
    console.log('   5. Look for "Test Shared Task for Position Completion"')
    console.log('   6. It should show position badges instead of "Due Today"')

  } catch (error) {
    console.error('❌ Test data creation failed:', error)
  }
}

createTestData()