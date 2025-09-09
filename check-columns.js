// Check what happens when we try to select specific columns
fetch('http://localhost:3000/api/admin/settings', {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
    'x-position-auth': 'true',
    'x-position-user-id': 'admin',
    'x-position-user-role': 'admin',
    'x-position-display-name': 'Test Admin'
  }
})
.then(response => response.json())
.then(data => {
  console.log('Available columns from GET:', Object.keys(data.data || {}))
  
  // Now try to update with minimal data
  const minimalUpdate = {
    timezone: 'Australia/Sydney',
    new_since_hour: '09:00',
    missed_cutoff_time: '23:59',
    auto_logout_enabled: true,
    task_generation_days_ahead: 365,
    task_generation_days_behind: 30,
    working_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
    public_holiday_push_forward: true
    // Deliberately omitting auto_logout_delay_minutes to see if that's the issue
  }
  
  return fetch('http://localhost:3000/api/admin/settings', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'x-position-auth': 'true',
      'x-position-user-id': 'admin',
      'x-position-user-role': 'admin',
      'x-position-display-name': 'Test Admin'
    },
    body: JSON.stringify(minimalUpdate)
  })
})
.then(response => response.json())
.then(data => {
  console.log('PUT Response (without auto_logout_delay_minutes):', data)
})
.catch(error => {
  console.error('Error:', error)
})