// Debug script to check checklist counts API
const fetch = require('node-fetch');

async function debugChecklistCounts() {
  const today = new Date().toISOString().split('T')[0];
  const roles = ['pharmacist-primary', 'pharmacist-secondary', 'pharmacy-assistant', 'pharmacy-technician'];
  
  console.log(`Debugging checklist counts for date: ${today}`);
  console.log('='.repeat(50));
  
  for (const role of roles) {
    try {
      const url = `http://localhost:3000/api/checklist/counts?date=${today}&role=${role}`;
      console.log(`\nTesting role: ${role}`);
      console.log(`URL: ${url}`);
      
      const response = await fetch(url);
      const result = await response.json();
      
      if (response.ok) {
        console.log('✅ Success:', JSON.stringify(result, null, 2));
      } else {
        console.log('❌ Error:', JSON.stringify(result, null, 2));
      }
    } catch (error) {
      console.log(`❌ Network error for ${role}:`, error.message);
    }
  }
}

debugChecklistCounts().catch(console.error);