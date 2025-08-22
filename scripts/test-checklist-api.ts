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

async function testChecklistAPI() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  
  console.log('Testing checklist API logic...')
  
  try {
    // Test the same logic as the API
    const validatedDate = '2025-01-20'
    const searchRoles = ['pharmacist-primary']
    
    console.log('1. Fetching master tasks...')
    
    // Base query to fetch active tasks visible by publish_delay
    let taskQuery = supabase
      .from('master_tasks')
      .select(`
        id,
        title,
        description,
        timing,
        due_time,
        publish_status,
        publish_delay,
        responsibility,
        categories,
        frequencies,
        created_at
      `)
      .eq('publish_status', 'active')
      .or(`publish_delay.is.null,publish_delay.lte.${validatedDate}`)

    const { data: masterTasks, error: tasksError } = await taskQuery
    console.log('Master tasks found:', masterTasks?.length || 0)

    if (tasksError) {
      console.error('Error fetching master tasks:', tasksError)
      return
    }

    if (!masterTasks || masterTasks.length === 0) {
      console.log('No master tasks found')
      return
    }

    console.log('Sample master task:', JSON.stringify(masterTasks[0], null, 2))

    // Filter by roles
    console.log('2. Filtering by roles:', searchRoles)
    
    const roleFiltered = masterTasks.filter(task => {
      if (!task.responsibility || !Array.isArray(task.responsibility)) {
        console.log(`Task ${task.title} has no responsibility array`)
        return false
      }
      
      const hasMatchingRole = task.responsibility.some(role => 
        searchRoles.includes(role)
      )
      
      console.log(`Task ${task.title} - responsibility: ${task.responsibility} - matches: ${hasMatchingRole}`)
      return hasMatchingRole
    })

    console.log('Role filtered tasks:', roleFiltered.length)

    // Test recurrence checking
    console.log('3. Testing recurrence logic...')
    
    const filteredTasks = roleFiltered.filter(task => {
      try {
        console.log(`Checking task: ${task.title}`)
        console.log(`- frequencies: ${JSON.stringify(task.frequencies)}`)
        console.log(`- created_at: ${task.created_at}`)
        
        // For now, just return true to see if we get results
        return true
      } catch (error) {
        console.error('Error checking task recurrence:', error)
        return false
      }
    })

    console.log('Final filtered tasks:', filteredTasks.length)

    // Create virtual checklist instances
    console.log('4. Creating virtual checklist instances...')
    
    const checklistInstances = filteredTasks.map(task => ({
      id: `virtual-${task.id}-${validatedDate}`,
      master_task_id: task.id,
      date: validatedDate,
      role: searchRoles[0], // Use first role for now
      status: 'pending',
      completed_by: null,
      completed_at: null,
      payload: {},
      notes: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      master_task: {
        id: task.id,
        title: task.title || 'Unknown Task',
        description: task.description,
        timing: task.timing || 'anytime_during_day',
        due_time: task.due_time,
        responsibility: task.responsibility || [],
        categories: task.categories || ['general'],
        frequencies: task.frequencies || { type: 'daily' }
      }
    }))

    console.log('Created checklist instances:', checklistInstances.length)
    
    if (checklistInstances.length > 0) {
      console.log('Sample checklist instance:')
      console.log(JSON.stringify(checklistInstances[0], null, 2))
    }

    console.log('✅ Checklist API logic test completed successfully!')
    
  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

testChecklistAPI()