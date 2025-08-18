// Test script to verify master task creation with multiple categories and responsibilities
const fetch = require('node-fetch');

async function testMasterTaskCreation() {
  const testData = {
    title: "Test Task with Multiple Categories",
    description: "Testing multiple categories and responsibilities",
    responsibility: ["pharmacist-primary", "pharmacy-assistants", "dispensary-technicians"],
    categories: ["stock-control", "compliance", "cleaning"],
    timing: "opening",
    due_time: "09:00",
    publish_status: "draft",
    frequency_rules: {
      type: "daily",
      every_n_days: 1,
      business_days_only: false
    },
    start_date: "2024-01-01"
  };

  try {
    console.log('Testing master task creation with data:', JSON.stringify(testData, null, 2));
    
    const response = await fetch('http://localhost:3001/api/master-tasks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // You'll need to add proper authentication headers here
      },
      body: JSON.stringify(testData)
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Task created successfully!');
      console.log('Created task:', JSON.stringify(result, null, 2));
      
      // Check if all categories and responsibilities were saved
      if (result.categories && result.categories.length === 3) {
        console.log('✅ All categories saved correctly:', result.categories);
      } else {
        console.log('❌ Categories not saved correctly. Expected 3, got:', result.categories?.length || 0);
      }
      
      if (result.responsibility && result.responsibility.length === 3) {
        console.log('✅ All responsibilities saved correctly:', result.responsibility);
      } else {
        console.log('❌ Responsibilities not saved correctly. Expected 3, got:', result.responsibility?.length || 0);
      }
    } else {
      console.log('❌ Error creating task:', result);
    }
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testMasterTaskCreation();