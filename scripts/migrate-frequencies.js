const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function migrateFrequencies() {
  try {
    console.log('Checking for records that need frequency migration...')
    
    // Get all records where frequencies is empty but frequency is not null
    const { data: tasksToMigrate, error: fetchError } = await supabase
      .from('master_tasks')
      .select('id, title, frequency, frequencies')
      .or('frequencies.is.null,frequencies.eq.{}')
      .not('frequency', 'is', null)
    
    if (fetchError) {
      console.error('Error fetching tasks:', fetchError.message)
      return
    }
    
    if (!tasksToMigrate || tasksToMigrate.length === 0) {
      console.log('✅ No tasks need frequency migration')
      
      // Check for tasks with empty frequencies
      const { data: emptyFreqTasks, error: emptyError } = await supabase
        .from('master_tasks')
        .select('id, title, frequency, frequencies')
        .or('frequencies.is.null,frequencies.eq.{}')
      
      if (emptyError) {
        console.error('Error checking empty frequencies:', emptyError.message)
        return
      }
      
      if (emptyFreqTasks && emptyFreqTasks.length > 0) {
        console.log(`\n⚠️  Found ${emptyFreqTasks.length} tasks with empty frequencies:`)
        emptyFreqTasks.forEach(task => {
          console.log(`- ${task.title}: frequency="${task.frequency}", frequencies=${JSON.stringify(task.frequencies)}`)
        })
        console.log('\nThese tasks may need manual frequency assignment.')
      }
      
      return
    }
    
    console.log(`Found ${tasksToMigrate.length} tasks that need migration:`)
    tasksToMigrate.forEach(task => {
      console.log(`- ${task.title}: "${task.frequency}" -> ["${task.frequency}"]`)
    })
    
    console.log('\nMigrating frequencies...')
    
    // Migrate each task
    for (const task of tasksToMigrate) {
      const { error: updateError } = await supabase
        .from('master_tasks')
        .update({ frequencies: [task.frequency] })
        .eq('id', task.id)
      
      if (updateError) {
        console.error(`❌ Failed to migrate task "${task.title}":`, updateError.message)
      } else {
        console.log(`✅ Migrated "${task.title}": frequencies = ["${task.frequency}"]`)
      }
    }
    
    console.log('\n✅ Migration completed!')
    
  } catch (error) {
    console.error('Error:', error.message)
  }
}

migrateFrequencies()