#!/usr/bin/env node

/**
 * Test Script for Auto-Logout Functionality
 * 
 * This script temporarily modifies the inactivity timeout to 10 seconds
 * for easy testing, then restores it back to 5 minutes.
 * 
 * Usage:
 * 1. Run: node test-auto-logout.js start
 * 2. Test the app in browser - stay idle for 10 seconds
 * 3. Run: node test-auto-logout.js restore
 */

const fs = require('fs');
const path = require('path');

const AUTH_FILE = path.join(__dirname, 'lib', 'auth.tsx');
const POSITION_AUTH_FILE = path.join(__dirname, 'lib', 'position-auth-context.tsx');

const TEST_TIMEOUT = '10 * 1000 // 10 seconds for testing';
const PRODUCTION_TIMEOUT = '5 * 60 * 1000 // 5 minutes';

function updateTimeouts(newTimeout) {
  try {
    // Update auth.tsx
    let authContent = fs.readFileSync(AUTH_FILE, 'utf8');
    authContent = authContent.replace(
      /const INACTIVITY_LIMIT_MS = .*/,
      `const INACTIVITY_LIMIT_MS = ${newTimeout}`
    );
    fs.writeFileSync(AUTH_FILE, authContent);
    console.log(`✓ Updated ${AUTH_FILE}`);

    // Update position-auth-context.tsx
    let positionAuthContent = fs.readFileSync(POSITION_AUTH_FILE, 'utf8');
    positionAuthContent = positionAuthContent.replace(
      /const INACTIVITY_LIMIT_MS = .*/,
      `const INACTIVITY_LIMIT_MS = ${newTimeout}`
    );
    fs.writeFileSync(POSITION_AUTH_FILE, positionAuthContent);
    console.log(`✓ Updated ${POSITION_AUTH_FILE}`);

  } catch (error) {
    console.error('Error updating files:', error.message);
    process.exit(1);
  }
}

const command = process.argv[2];

switch (command) {
  case 'start':
    console.log('🔧 Setting up auto-logout test (10 seconds timeout)...');
    updateTimeouts(TEST_TIMEOUT);
    console.log('✅ Test setup complete!');
    console.log('📝 Instructions:');
    console.log('   1. Open http://localhost:3001');
    console.log('   2. Login to any account');
    console.log('   3. Stay idle for 10 seconds');
    console.log('   4. You should be automatically logged out and redirected to home page');
    console.log('   5. Run "node test-auto-logout.js restore" when done testing');
    break;

  case 'restore':
    console.log('🔄 Restoring production timeout (5 minutes)...');
    updateTimeouts(PRODUCTION_TIMEOUT);
    console.log('✅ Production settings restored!');
    break;

  default:
    console.log('Usage:');
    console.log('  node test-auto-logout.js start   - Set up 10 second timeout for testing');
    console.log('  node test-auto-logout.js restore - Restore 5 minute timeout for production');
    break;
}