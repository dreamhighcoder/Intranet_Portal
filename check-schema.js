// Simple script to check system_settings table schema
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
  console.log('GET Response:', JSON.stringify(data, null, 2))
})
.catch(error => {
  console.error('Error:', error)
})