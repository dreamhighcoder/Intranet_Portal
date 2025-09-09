import { supabaseServer } from '@/lib/supabase-server'

async function testDirectUpdate() {
  try {
    console.log('🔍 Testing direct SQL update...')
    
    // First, let's see what columns actually exist
    const { data: columns, error: columnsError } = await supabaseServer
      .from('information_schema.columns')
      .select('column_name, data_type')
      .eq('table_name', 'system_settings')
      .eq('table_schema', 'public')
    
    console.log('📋 Available columns:', columns)
    if (columnsError) {
      console.error('❌ Error getting columns:', columnsError)
    }
    
    // Try to get current settings
    const { data: currentSettings, error: fetchError } = await supabaseServer
      .from('system_settings')
      .select('*')
      .limit(1)
      .single()
    
    console.log('📄 Current settings:', currentSettings)
    if (fetchError) {
      console.error('❌ Error fetching settings:', fetchError)
    }
    
    // Try a simple update without the problematic column
    const { data: updateResult, error: updateError } = await supabaseServer
      .from('system_settings')
      .update({ timezone: 'Australia/Sydney' })
      .eq('id', currentSettings?.id)
      .select()
    
    console.log('✏️ Simple update result:', { updateResult, updateError })
    
  } catch (error) {
    console.error('❌ Exception:', error)
  }
}

testDirectUpdate()