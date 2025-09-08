#!/usr/bin/env tsx

/**
 * Test script to verify system settings functionality
 */

import { getSystemSettings, updateSystemSettings, clearSettingsCache } from '../lib/system-settings'

async function testSystemSettings() {
  console.log('🧪 Testing System Settings...\n')

  try {
    // Test 1: Load default settings
    console.log('1️⃣ Loading default settings...')
    const defaultSettings = await getSystemSettings()
    console.log('✅ Default settings loaded:', {
      timezone: defaultSettings.timezone,
      new_since_hour: defaultSettings.new_since_hour,
      missed_cutoff_time: defaultSettings.missed_cutoff_time,
      auto_logout_enabled: defaultSettings.auto_logout_enabled,
      auto_logout_delay_minutes: defaultSettings.auto_logout_delay_minutes,
      task_generation_days_ahead: defaultSettings.task_generation_days_ahead,
      task_generation_days_behind: defaultSettings.task_generation_days_behind,
      working_days: defaultSettings.working_days,
      public_holiday_push_forward: defaultSettings.public_holiday_push_forward
    })

    // Test 2: Update settings
    console.log('\n2️⃣ Updating settings...')
    const testSettings = {
      ...defaultSettings,
      new_since_hour: '08:00',
      missed_cutoff_time: '22:00',
      auto_logout_delay_minutes: 10,
      task_generation_days_ahead: 180,
      task_generation_days_behind: 7,
      working_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
    }

    await updateSystemSettings(testSettings)
    console.log('✅ Settings updated successfully')

    // Test 3: Verify updated settings
    console.log('\n3️⃣ Verifying updated settings...')
    clearSettingsCache() // Clear cache to force reload from database
    const updatedSettings = await getSystemSettings()
    
    const verifications = [
      { key: 'new_since_hour', expected: '08:00', actual: updatedSettings.new_since_hour },
      { key: 'missed_cutoff_time', expected: '22:00', actual: updatedSettings.missed_cutoff_time },
      { key: 'auto_logout_delay_minutes', expected: 10, actual: updatedSettings.auto_logout_delay_minutes },
      { key: 'task_generation_days_ahead', expected: 180, actual: updatedSettings.task_generation_days_ahead },
      { key: 'task_generation_days_behind', expected: 7, actual: updatedSettings.task_generation_days_behind },
      { key: 'working_days', expected: 5, actual: updatedSettings.working_days.length }
    ]

    let allPassed = true
    for (const verification of verifications) {
      const passed = verification.expected === verification.actual
      console.log(`${passed ? '✅' : '❌'} ${verification.key}: ${verification.actual} ${passed ? '(correct)' : `(expected ${verification.expected})`}`)
      if (!passed) allPassed = false
    }

    // Test 4: Restore default settings
    console.log('\n4️⃣ Restoring default settings...')
    await updateSystemSettings(defaultSettings)
    console.log('✅ Default settings restored')

    console.log(`\n🎉 System Settings Test ${allPassed ? 'PASSED' : 'FAILED'}`)
    
  } catch (error) {
    console.error('❌ System Settings Test FAILED:', error)
    process.exit(1)
  }
}

// Run the test
testSystemSettings().catch(console.error)