import { NextRequest, NextResponse } from 'next/server'
import { requireAuthEnhanced } from '@/lib/auth-middleware'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

console.log('Master tasks reorder - Environment check:', {
  hasSupabaseUrl: !!supabaseUrl,
  hasServiceKey: !!supabaseServiceKey,
  supabaseUrlLength: supabaseUrl?.length,
  serviceKeyLength: supabaseServiceKey?.length
})

export async function POST(request: NextRequest) {
  console.log('Master tasks reorder POST - Starting request processing')
  try {
    // Validate environment early with clear message
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Master tasks reorder POST - Missing Supabase env vars')
      return NextResponse.json({
        error: 'Server misconfiguration: missing Supabase URL or Service Role Key'
      }, { status: 500 })
    }

    console.log('Master tasks reorder POST - Attempting authentication')
    const user = await requireAuthEnhanced(request)
    console.log('Master tasks reorder POST - Authentication successful:', user)
    
    // Check if user is admin
    if (user.role !== 'admin') {
      console.log('Master tasks reorder POST - Access denied, user is not admin')
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }
    
    // Create admin Supabase client for database operations
    console.log('Master tasks reorder POST - Creating Supabase client')
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    console.log('Master tasks reorder POST - Supabase client created successfully')

    console.log('Master tasks reorder POST - Parsing request body')
    const body = await request.json()
    console.log('Master tasks reorder POST - Request body parsed:', body)
    
    const { order, resetAll } = body

    // Fast path: reset all custom_order to a special value that indicates default sorting
    if (resetAll === true) {
      console.log('Master tasks reorder POST - Resetting all custom_order for default sorting')

      // Since custom_order has NOT NULL constraint, we'll use a special approach:
      // Set all custom_order values to a very high number (999999) to push them to the end
      // The frontend will treat these as "unordered" and apply default sorting
      const RESET_VALUE = 999999

      const { error: clearError } = await supabase
        .from('master_tasks')
        .update({ custom_order: RESET_VALUE })
        .lt('custom_order', RESET_VALUE) // Only update rows that don't already have the reset value

      if (clearError) {
        console.error('Master tasks reorder POST - Failed to reset custom_order:', clearError)
        return NextResponse.json({
          error: 'Failed to reset ordering',
          details: clearError.message,
          code: clearError.code
        }, { status: 500 })
      }

      console.log('Master tasks reorder POST - Reset successful. All custom_order values set to reset value')
      return NextResponse.json({ success: true, resetAll: true })
    }
    
    console.log('Master tasks reorder POST - Extracted order:', order)
    
    if (!Array.isArray(order)) {
      console.log('Master tasks reorder POST - Order is not an array:', typeof order)
      return NextResponse.json({ error: 'Order must be an array' }, { status: 400 })
    }
    
    console.log('Master tasks reorder POST - Updating order for', order.length, 'tasks')
    console.log('Master tasks reorder POST - Sample order items:', order.slice(0, 3))
    
    // First, validate that all task IDs exist
    const taskIds = order.map((item: any) => item.id)
    const { data: existingTasks, error: fetchError } = await supabase
      .from('master_tasks')
      .select('id')
      .in('id', taskIds)
    
    if (fetchError) {
      console.error('Master tasks reorder POST - Error fetching existing tasks:', fetchError)
      return NextResponse.json({ error: 'Failed to validate task IDs' }, { status: 500 })
    }
    
    const existingTaskIds = new Set(existingTasks?.map(t => t.id) || [])
    const missingTaskIds = taskIds.filter((id: string) => !existingTaskIds.has(id))
    
    if (missingTaskIds.length > 0) {
      console.error('Master tasks reorder POST - Missing task IDs:', missingTaskIds)
      return NextResponse.json({ 
        error: 'Some task IDs do not exist', 
        missingIds: missingTaskIds 
      }, { status: 400 })
    }
    
    console.log('Master tasks reorder POST - All task IDs validated successfully')
    
    // Update each task's custom_order
    const updates = order.map(async (item: { id: string; custom_order: number | null }) => {
      console.log(`Updating task ${item.id} with custom_order: ${item.custom_order}`)
      
      const { error, data } = await supabase
        .from('master_tasks')
        .update({ custom_order: item.custom_order })
        .eq('id', item.id)
        .select()
      
      if (error) {
        console.error('Error updating task order for task', item.id, ':', error)
        throw error
      }
      
      console.log(`Successfully updated task ${item.id}:`, data)
      return data
    })
    
    try {
      const results = await Promise.all(updates)
      console.log('Master tasks reorder POST - Successfully updated task order for', results.length, 'tasks')
      return NextResponse.json({ success: true, updated: results.length })
    } catch (updateError: any) {
      console.error('Master tasks reorder POST - Error during batch update:', updateError)
      return NextResponse.json({
        error: 'Failed to update ordering',
        details: updateError?.message || 'Unknown error'
      }, { status: 500 })
    }
  } catch (error: any) {
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