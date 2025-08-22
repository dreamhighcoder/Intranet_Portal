import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

async function testAPIEndpoint() {
  console.log('Testing checklist API endpoint...')
  
  try {
    // Create a Supabase client for authentication
    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    
    // First, let's try to get a user session (you might need to sign in first)
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError) {
      console.error('Session error:', sessionError)
    }
    
    if (!session) {
      console.log('No active session found. Trying to sign in...')
      
      // You might need to sign in with actual credentials
      // For now, let's try without authentication to see the error
      console.log('Making unauthenticated request to see the error...')
    }
    
    // Make request to the API endpoint
    const apiUrl = 'http://localhost:3001/api/checklist?date=2025-01-20&roles=pharmacist-primary'
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }
    
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`
    }
    
    console.log('Making request to:', apiUrl)
    console.log('Headers:', headers)
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers
    })
    
    console.log('Response status:', response.status)
    console.log('Response headers:', Object.fromEntries(response.headers.entries()))
    
    const responseText = await response.text()
    console.log('Response body:', responseText)
    
    if (response.ok) {
      try {
        const data = JSON.parse(responseText)
        console.log('✅ API call successful!')
        console.log('Number of checklist instances:', data.length || 'N/A')
        
        if (Array.isArray(data) && data.length > 0) {
          console.log('Sample checklist instance:')
          console.log(JSON.stringify(data[0], null, 2))
        }
      } catch (parseError) {
        console.log('Response is not JSON:', responseText)
      }
    } else {
      console.log('❌ API call failed')
      console.log('Status:', response.status)
      console.log('Response:', responseText)
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

testAPIEndpoint()