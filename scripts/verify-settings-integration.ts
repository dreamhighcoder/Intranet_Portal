#!/usr/bin/env tsx

/**
 * Verification script to check system settings integration
 */

import { getSystemSettings } from '../lib/system-settings'
import { getTaskGenerationSettings } from '../lib/system-settings'

async function verifySettingsIntegration() {
  console.log('🔍 Verifying System Settings Integration...\n')

  try {
    // Test 1: Load system settings
    console.log('1️⃣ Loading system settings...')
    const settings = await getSystemSettings()
    console.log('✅ System settings loaded successfully')
    console.log('   - Timezone:', settings.timezone)
    console.log('   - New Since Hour:', settings.new_since_hour)
    console.log('   - Missed Cutoff Time:', settings.missed_cutoff_time)
    console.log('   - Auto Logout Enabled:', settings.auto_logout_enabled)
    console.log('   - Auto Logout Delay (minutes):', settings.auto_logout_delay_minutes)
    console.log('   - Task Generation Days Ahead:', settings.task_generation_days_ahead)
    console.log('   - Task Generation Days Behind:', settings.task_generation_days_behind)
    console.log('   - Working Days:', settings.working_days.join(', '))
    console.log('   - Public Holiday Push Forward:', settings.public_holiday_push_forward)

    // Test 2: Load task generation settings
    console.log('\n2️⃣ Loading task generation settings...')
    const taskSettings = await getTaskGenerationSettings()
    console.log('✅ Task generation settings loaded successfully')
    console.log('   - Days Ahead:', taskSettings.daysAhead)
    console.log('   - Days Behind:', taskSettings.daysBehind)
    console.log('   - Working Days:', taskSettings.workingDays.join(', '))

    // Test 3: Verify consistency
    console.log('\n3️⃣ Verifying consistency...')
    const consistent = (
      settings.task_generation_days_ahead === taskSettings.daysAhead &&
      settings.task_generation_days_behind === taskSettings.daysBehind &&
      JSON.stringify(settings.working_days) === JSON.stringify(taskSettings.workingDays)
    )
    
    if (consistent) {
      console.log('✅ Settings are consistent across different access methods')
    } else {
      console.log('❌ Settings inconsistency detected!')
      console.log('   System settings:', {
        ahead: settings.task_generation_days_ahead,
        behind: settings.task_generation_days_behind,
        workingDays: settings.working_days
      })
      console.log('   Task settings:', {
        ahead: taskSettings.daysAhead,
        behind: taskSettings.daysBehind,
        workingDays: taskSettings.workingDays
      })
    }

    console.log('\n🎉 System Settings Integration Verification Complete')
    
  } catch (error) {
    console.error('❌ Verification failed:', error)
    process.exit(1)
  }
}

// Run the verification
verifySettingsIntegration().catch(console.error)