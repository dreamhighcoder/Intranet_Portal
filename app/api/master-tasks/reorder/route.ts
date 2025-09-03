import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
  console.log('Master tasks reorder POST - Starting request processing')
  try {
    console.log('Master tasks reorder POST - Attempting authentication')
    const user = await requireAuth(request)
    
    // Check if user is admin
    if (user.role !== 'admin') {
      console.log('Master tasks reorder POST - Access denied, user is not admin')
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }
    
    console.log('Master tasks reorder POST - Authentication successful')
    
    // Create admin Supabase client for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const body = await request.json()
    const { order } = body
    
    if (!Array.isArray(order)) {
      return NextResponse.json({ error: 'Order must be an array' }, { status: 400 })
    }
    
    console.log('Master tasks reorder POST - Updating order for', order.length, 'tasks')
    
    // Update each task's custom_order
    const updates = order.map(async (item: { id: string; custom_order: number }) => {
      const { error } = await supabase
        .from('master_tasks')
        .update({ custom_order: item.custom_order })
        .eq('id', item.id)
      
      if (error) {
        console.error('Error updating task order:', error)
        throw error
      }
    })
    
    await Promise.all(updates)
    
    console.log('Master tasks reorder POST - Successfully updated task order')
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Master tasks reorder POST - Error:', error)
    
    if (error instanceof Error) {
      if (error.message.includes('Authentication')) {
        console.log('Master tasks reorder POST - Authentication error')
        return NextResponse.json({ error: error.message }, { status: 401 })
      }
    }
    
    console.error('Master tasks reorder POST - Unexpected error:', error)
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}