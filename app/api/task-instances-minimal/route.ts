import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data: taskInstances, error } = await supabase
      .from('task_instances')
      .select(`
        *,
        master_tasks!inner (
          id,
          title,
          description,
          frequencies,
          timing,
          categories,
          responsibility
        )
      `)
      .limit(10)

    if (error) {
      return NextResponse.json({ 
        error: 'Database error',
        details: error
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: taskInstances || []
    })

  } catch (error) {
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}