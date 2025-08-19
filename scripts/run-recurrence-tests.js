/**
 * Test Runner for New Recurrence Engine
 * Node.js script to run the comprehensive test suite
 */

const { execSync } = require('child_process')
const path = require('path')

console.log('🧪 Running New Recurrence Engine Test Suite')
console.log('=' .repeat(60))

try {
  // Run the TypeScript test file using tsx
  const testFile = path.join(__dirname, 'test-new-recurrence-engine.ts')
  
  console.log('📁 Test file:', testFile)
  console.log('🚀 Starting tests...\n')
  
  // Execute the test file
  execSync(`npx tsx "${testFile}"`, {
    stdio: 'inherit',
    cwd: path.dirname(__dirname)
  })
  
  console.log('\n🎉 All tests passed successfully!')
  
} catch (error) {
  console.error('\n❌ Tests failed:', error.message)
  process.exit(1)
}