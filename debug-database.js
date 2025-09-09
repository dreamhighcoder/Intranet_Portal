// Debug database - run this in browser console
console.log('🔍 Debugging database records...');

import('./lib/supabase.js').then(async (supabaseModule) => {
  try {
    // Check all system_settings records
    const { data: allSettings, error: allError } = await supabaseModule.supabase
      .from('system_settings')
      .select('*');
    
    console.log('All system_settings records:', { error: allError, data: allSettings });
    
    if (allSettings) {
      console.log('Keys found in database:', allSettings.map(row => row.key));
      
      // Look for auto-logout related keys
      const autoLogoutKeys = allSettings.filter(row => 
        row.key.includes('auto') || row.key.includes('logout') || row.key.includes('delay')
      );
      console.log('Auto-logout related keys:', autoLogoutKeys);
    }
    
    // Try different possible key names
    const possibleKeys = [
      'auto_logout_enabled',
      'auto_logout_delay_seconds', 
      'auto_logout_delay_minutes',
      'autologout_enabled',
      'autologout_delay',
      'logout_delay',
      'session_timeout'
    ];
    
    for (const key of possibleKeys) {
      const { data, error } = await supabaseModule.supabase
        .from('system_settings')
        .select('*')
        .eq('key', key);
      
      if (data && data.length > 0) {
        console.log(`✅ Found key "${key}":`, data[0]);
      } else {
        console.log(`❌ Key "${key}" not found`);
      }
    }
    
  } catch (error) {
    console.error('Database debug failed:', error);
  }
});