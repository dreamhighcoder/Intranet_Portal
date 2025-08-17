#!/usr/bin/env node

/**
 * Node.js Script: Generate Daily Checklists
 * Pharmacy Intranet Portal - Alternative to Supabase Edge Function
 * 
 * This script can be used to:
 * - Generate checklist instances for a specific date
 * - Update instance statuses
 * - Run from cron jobs or manually
 * - Test the system without deploying Edge functions
 * 
 * Usage:
 *   node scripts/generate-daily-checklists.js [options]
 *   
 * Options:
 *   --date=YYYY-MM-DD     Date to generate for (default: today)
 *   --test-mode           Enable test mode (no database changes)
 *   --dry-run             Enable dry run mode (show what would happen)
 *   --force-regenerate    Force regeneration of existing instances
 *   --update-statuses     Also update instance statuses
 *   --max-tasks=N         Maximum tasks to process
 *   --log-level=LEVEL     Log level (silent, info, debug)
 *   --help                Show this help message
 * 
 * Examples:
 *   node scripts/generate-daily-checklists.js
 *   node scripts/generate-daily-checklists.js --date=2024-01-15 --dry-run
 *   node scripts/generate-daily-checklists.js --test-mode --max-tasks=100
 */

const { createTaskInstanceGenerator } = require('../lib/task-instance-generator')
const { createStatusManager } = require('../lib/status-manager')
const { createHolidayHelper } = require('../lib/public-holidays')

// ========================================
// ARGUMENT PARSING
// ========================================

function parseArguments() {
  const args = process.argv.slice(2)
  const options = {
    date: new Date().toISOString().split('T')[0],
    testMode: false,
    dryRun: false,
    forceRegenerate: false,
    updateStatuses: true,
    maxTasks: undefined,
    logLevel: 'info'
  }

  for (const arg of args) {
    if (arg === '--help' || arg === '-h') {
      showHelp()
      process.exit(0)
    } else if (arg.startsWith('--date=')) {
      options.date = arg.split('=')[1]
    } else if (arg === '--test-mode') {
      options.testMode = true
    } else if (arg === '--dry-run') {
      options.dryRun = true
    } else if (arg === '--force-regenerate') {
      options.forceRegenerate = true
    } else if (arg === '--no-update-statuses') {
      options.updateStatuses = false
    } else if (arg.startsWith('--max-tasks=')) {
      options.maxTasks = parseInt(arg.split('=')[1])
    } else if (arg.startsWith('--log-level=')) {
      options.logLevel = arg.split('=')[1]
    } else {
      console.error(`Unknown argument: ${arg}`)
      showHelp()
      process.exit(1)
    }
  }

  return options
}

function showHelp() {
  console.log(`
Node.js Script: Generate Daily Checklists
Pharmacy Intranet Portal - Alternative to Supabase Edge Function

Usage:
  node scripts/generate-daily-checklists.js [options]

Options:
  --date=YYYY-MM-DD     Date to generate for (default: today)
  --test-mode           Enable test mode (no database changes)
  --dry-run             Enable dry run mode (show what would happen)
  --force-regenerate    Force regeneration of existing instances
  --no-update-statuses  Skip status updates
  --max-tasks=N         Maximum tasks to process
  --log-level=LEVEL     Log level (silent, info, debug)
  --help                Show this help message

Examples:
  node scripts/generate-daily-checklists.js
  node scripts/generate-daily-checklists.js --date=2024-01-15 --dry-run
  node scripts/generate-daily-checklists.js --test-mode --max-tasks=100
  node scripts/generate-daily-checklists.js --log-level=debug
`)
}

// ========================================
// MAIN EXECUTION
// ========================================

async function main() {
  const startTime = Date.now()
  const options = parseArguments()

  console.log('='.repeat(60))
  console.log('Daily Checklist Generation Script')
  console.log('Pharmacy Intranet Portal')
  console.log('='.repeat(60))
  console.log(`Date: ${options.date}`)
  console.log(`Mode: ${options.testMode ? 'TEST' : 'PRODUCTION'}`)
  console.log(`Dry Run: ${options.dryRun}`)
  console.log(`Force Regenerate: ${options.forceRegenerate}`)
  console.log(`Update Statuses: ${options.updateStatuses}`)
  if (options.maxTasks) console.log(`Max Tasks: ${options.maxTasks}`)
  console.log(`Log Level: ${options.logLevel}`)
  console.log('='.repeat(60))

  try {
    // Step 1: Load public holidays
    console.log('\n📅 Loading public holidays...')
    const holidays = await loadPublicHolidays(options.date)
    console.log(`✅ Loaded ${holidays.length} public holidays`)

    // Step 2: Generate checklist instances
    console.log('\n🔄 Generating checklist instances...')
    const generator = createTaskInstanceGenerator(holidays, options.logLevel)
    
    const generationResult = await generator.generateForDate({
      date: options.date,
      testMode: options.testMode,
      dryRun: options.dryRun,
      forceRegenerate: options.forceRegenerate,
      maxTasks: options.maxTasks
    })

    console.log(`✅ Generation completed in ${generationResult.executionTime}ms`)
    console.log(`   Total tasks: ${generationResult.totalTasks}`)
    console.log(`   Due tasks: ${generationResult.dueTasks}`)
    console.log(`   Instances created: ${generationResult.instancesCreated}`)
    console.log(`   Instances skipped: ${generationResult.instancesSkipped}`)
    console.log(`   Errors: ${generationResult.errors}`)

    // Step 3: Update statuses if requested
    let statusUpdateResult = null
    if (options.updateStatuses && !options.dryRun) {
      console.log('\n🔄 Updating instance statuses...')
      const statusManager = createStatusManager(undefined, options.logLevel)
      
      statusUpdateResult = await statusManager.updateStatusesForDate({
        date: options.date,
        testMode: options.testMode,
        maxInstances: options.maxTasks
      })

      console.log(`✅ Status update completed in ${statusUpdateResult.executionTime}ms`)
      console.log(`   Total instances: ${statusUpdateResult.totalInstances}`)
      console.log(`   Instances updated: ${statusUpdateResult.instancesUpdated}`)
      console.log(`   Instances skipped: ${statusUpdateResult.instancesSkipped}`)
      console.log(`   Errors: ${statusUpdateResult.errors}`)
    }

    // Step 4: Summary
    const executionTime = Date.now() - startTime
    console.log('\n' + '='.repeat(60))
    console.log('EXECUTION SUMMARY')
    console.log('='.repeat(60))
    console.log(`Total execution time: ${executionTime}ms`)
    console.log(`Generation success: ${generationResult.errors === 0 ? '✅' : '❌'}`)
    
    if (statusUpdateResult) {
      console.log(`Status update success: ${statusUpdateResult.errors === 0 ? '✅' : '❌'}`)
    }
    
    console.log(`Overall success: ${generationResult.errors === 0 && (!statusUpdateResult || statusUpdateResult.errors === 0) ? '✅' : '❌'}`)
    
    // Show warnings if any
    if (generationResult.instancesSkipped > 0) {
      console.log(`⚠️  ${generationResult.instancesSkipped} instances skipped (already existed)`)
    }
    
    if (statusUpdateResult && statusUpdateResult.instancesSkipped > 0) {
      console.log(`⚠️  ${statusUpdateResult.instancesSkipped} status updates skipped`)
    }

    // Show errors if any
    if (generationResult.errors > 0) {
      console.log(`❌ Generation errors: ${generationResult.errors}`)
      generationResult.results
        .filter(r => r.error)
        .forEach(r => console.log(`   - ${r.taskTitle}: ${r.error}`))
    }
    
    if (statusUpdateResult && statusUpdateResult.errors > 0) {
      console.log(`❌ Status update errors: ${statusUpdateResult.errors}`)
      statusUpdateResult.results
        .filter(r => r.error)
        .forEach(r => console.log(`   - Instance ${r.instanceId}: ${r.error}`))
    }

    console.log('='.repeat(60))

    // Exit with appropriate code
    const success = generationResult.errors === 0 && (!statusUpdateResult || statusUpdateResult.errors === 0)
    process.exit(success ? 0 : 1)

  } catch (error) {
    const executionTime = Date.now() - startTime
    console.error('\n❌ Script failed:', error.message)
    console.error(`Execution time: ${executionTime}ms`)
    console.error('Stack trace:', error.stack)
    process.exit(1)
  }
}

// ========================================
// HELPER FUNCTIONS
// ========================================

/**
 * Load public holidays for a specific date
 * In production, this would fetch from the database
 */
async function loadPublicHolidays(date) {
  try {
    // For this script, we'll return a sample holiday
    // In production, you would fetch from your public_holidays table
    const sampleHolidays = [
      { date: '2024-01-01', name: 'New Year\'s Day' },
      { date: '2024-01-26', name: 'Australia Day' },
      { date: '2024-04-25', name: 'ANZAC Day' },
      { date: '2024-12-25', name: 'Christmas Day' },
      { date: '2024-12-26', name: 'Boxing Day' }
    ]

    // Filter holidays for the specific date
    const holidaysForDate = sampleHolidays.filter(h => h.date === date)
    
    if (holidaysForDate.length > 0) {
      console.log(`   Found holiday: ${holidaysForDate[0].name}`)
    }

    return holidaysForDate
  } catch (error) {
    console.warn(`   Warning: Could not load public holidays: ${error.message}`)
    return []
  }
}

// ========================================
// ERROR HANDLING
// ========================================

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
  process.exit(1)
})

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
  process.exit(1)
})

// ========================================
// EXECUTION
// ========================================

if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
}

module.exports = { main, parseArguments }
