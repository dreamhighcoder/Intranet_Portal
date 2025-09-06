const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://oabhsaqryrldhqscntck.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9hYmhzYXFyeXJsZGhxc2NudGNrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTA0ODMwOSwiZXhwIjoyMDcwNjI0MzA5fQ.BfMDs-UDzDCxU42ADtU9JuLX18M4N1nBrljpnoUQqwI'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkCurrentState() {
  console.log('🔍 Checking current state of master tasks and instances...')
  
  try {
    // 1. Check master tasks with every_day frequency
    console.log('\n📋 Master tasks with every_day frequency:')
    const { data: masterTasks, error: masterError } = await supabase
      .from('master_tasks')
      .select('id, title, frequencies, publish_status, created_at')
      .contains('frequencies', ['every_day'])
      .eq('publish_status', 'active')
      .order('created_at', { ascending: false })
      .limit(5)
    
    if (masterError) {
      console.error('❌ Error fetching master tasks:', masterError)
      return
    }
    
    if (!masterTasks || masterTasks.length === 0) {
      console.log('❌ No active master tasks with every_day frequency found')
      return
    }
    
    masterTasks.forEach(task => {
      console.log(`  - ${task.title} (${task.id})`)
      console.log(`    Frequencies: ${JSON.stringify(task.frequencies)}`)
      console.log(`    Created: ${task.created_at}`)
    })
    
    // 2. Check task instances for today
    const today = new Date().toISOString().split('T')[0] // Simple date format
    console.log(`\n📅 Task instances for ${today}:`)
    
    const masterTaskIds = masterTasks.map(t => t.id)
    const { data: instances, error: instanceError } = await supabase
      .from('task_instances')
      .select('id, master_task_id, instance_date, status, created_at')
      .in('master_task_id', masterTaskIds)
      .eq('instance_date', today)
    
    if (instanceError) {
      console.error('❌ Error fetching instances:', instanceError)
      return
    }
    
    if (!instances || instances.length === 0) {
      console.log('❌ No task instances found for today')
      console.log('🔧 This suggests the task generation is not working')
    } else {
      console.log(`✅ Found ${instances.length} instances for today:`)
      instances.forEach(instance => {
        const masterTask = masterTasks.find(t => t.id === instance.master_task_id)
        console.log(`  - ${masterTask?.title || 'Unknown'} (${instance.status})`)
        console.log(`    Instance ID: ${instance.id}`)
        console.log(`    Created: ${instance.created_at}`)
      })
    }
    
    // 3. Check if there are any instances at all for these tasks
    console.log('\n📊 All instances for every_day tasks (last 7 days):')
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    const weekAgoStr = weekAgo.toISOString().split('T')[0]
    
    const { data: allInstances, error: allError } = await supabase
      .from('task_instances')
      .select('id, master_task_id, instance_date, status')
      .in('master_task_id', masterTaskIds)
      .gte('instance_date', weekAgoStr)
      .order('instance_date', { ascending: false })
    
    if (allError) {
      console.error('❌ Error fetching all instances:', allError)
    } else if (!allInstances || allInstances.length === 0) {
      console.log('❌ No instances found in the last 7 days')
      console.log('🔧 This confirms task generation is not working')
    } else {
      console.log(`✅ Found ${allInstances.length} instances in the last 7 days`)
      
      // Group by date
      const byDate = {}
      allInstances.forEach(instance => {
        if (!byDate[instance.instance_date]) {
          byDate[instance.instance_date] = []
        }
        byDate[instance.instance_date].push(instance)
      })
      
      Object.keys(byDate).sort().reverse().forEach(date => {
        console.log(`  ${date}: ${byDate[date].length} instances`)
      })
    }
    
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

checkCurrentState()