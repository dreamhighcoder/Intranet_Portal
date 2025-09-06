// Fix existing every_day tasks by generating instances for them
// This will solve the immediate problem while we investigate the automatic generation

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://oabhsaqryrldhqscntck.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9hYmhzYXFyeXJsZGhxc2NudGNrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTA0ODMwOSwiZXhwIjoyMDcwNjI0MzA5fQ.BfMDs-UDzDCxU42ADtU9JuLX18M4N1nBrljpnoUQqwI'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function fixExistingTasks() {
  console.log('🔧 Fixing existing every_day tasks by generating instances...')
  
  try {
    // Get all active master tasks with every_day frequency
    const { data: masterTasks, error: masterError } = await supabase
      .from('master_tasks')
      .select('*')
      .contains('frequencies', ['every_day'])
      .eq('publish_status', 'active')
    
    if (masterError) {
      console.error('❌ Error fetching master tasks:', masterError)
      return
    }
    
    if (!masterTasks || masterTasks.length === 0) {
      console.log('❌ No active every_day tasks found')
      return
    }
    
    console.log(`✅ Found ${masterTasks.length} every_day tasks`)
    
    // Generate instances for today and the next few days
    const dates = []
    const today = new Date()
    for (let i = 0; i < 7; i++) { // Generate for next 7 days
      const date = new Date(today)
      date.setDate(today.getDate() + i)
      const dateStr = date.toISOString().split('T')[0]
      
      // Skip Sundays (day 0)
      if (date.getDay() !== 0) {
        dates.push(dateStr)
      }
    }
    
    console.log(`📅 Generating instances for dates: ${dates.join(', ')}`)
    
    let totalCreated = 0
    
    for (const date of dates) {
      console.log(`\n📅 Processing date: ${date}`)
      
      // Check if instances already exist for this date
      const { data: existingInstances } = await supabase
        .from('task_instances')
        .select('master_task_id')
        .eq('instance_date', date)
      
      const existingTaskIds = new Set(existingInstances?.map(i => i.master_task_id) || [])
      
      for (const task of masterTasks) {
        if (existingTaskIds.has(task.id)) {
          console.log(`  ⏭️  Skipping ${task.title} (instance already exists)`)
          continue
        }
        
        try {
          const instanceData = {
            master_task_id: task.id,
            instance_date: date,
            due_date: date, // For every_day tasks, due same day
            status: 'not_due',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
          
          const { data: newInstance, error: createError } = await supabase
            .from('task_instances')
            .insert(instanceData)
            .select()
            .single()
          
          if (createError) {
            console.error(`  ❌ Error creating instance for ${task.title}:`, createError.message)
          } else {
            console.log(`  ✅ Created instance for: ${task.title}`)
            totalCreated++
          }
          
        } catch (err) {
          console.error(`  ❌ Exception creating instance for ${task.title}:`, err.message)
        }
      }
    }
    
    console.log(`\n🎉 Fix completed! Created ${totalCreated} task instances`)
    console.log('📋 Your every_day tasks should now appear in the checklist!')
    
  } catch (error) {
    console.error('❌ Fix failed:', error)
  }
}

fixExistingTasks()