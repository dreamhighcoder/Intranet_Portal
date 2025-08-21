const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkSchema() {
  try {
    console.log('Checking master_tasks table schema...')
    
    // Check if frequencies column exists
    const { data, error } = await supabase
      .from('master_tasks')
      .select('id, frequencies, responsibility, categories, due_time, timing')
      .limit(1)
    
    if (error) {
      console.error('Error checking schema:', error.message)
      
      if (error.message.includes('column "frequencies" does not exist')) {
        console.log('\n❌ frequencies column is missing!')
        console.log('Please run the migration: supabase/migrations/005_update_frequency_to_array.sql')
      }
      
      if (error.message.includes('column "responsibility" does not exist')) {
        console.log('\n❌ responsibility column is missing!')
        console.log('Please run the migration: supabase/migration-add-missing-fields.sql')
      }
      
      if (error.message.includes('column "categories" does not exist')) {
        console.log('\n❌ categories column is missing!')
        console.log('Please run the migration: supabase/migration-add-missing-fields.sql')
      }
      
      return
    }
    
    console.log('✅ Schema check passed!')
    console.log('Available columns:', Object.keys(data[0] || {}))
    
    if (data && data.length > 0) {
      const sample = data[0]
      console.log('\nSample data:')
      console.log('- frequencies:', sample.frequencies)
      console.log('- responsibility:', sample.responsibility)
      console.log('- categories:', sample.categories)
      console.log('- due_time:', sample.due_time)
      console.log('- timing:', sample.timing)
    }
    
  } catch (error) {
    console.error('Error:', error.message)
  }
}

checkSchema()