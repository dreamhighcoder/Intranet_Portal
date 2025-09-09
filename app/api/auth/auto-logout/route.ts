import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { requireAuth } from '@/lib/auth-middleware'
import { getResponsibilityForPosition } from '@/lib/position-utils'

export async function POST(request: NextRequest) {
  console.log('🚫 Auto-logout POST endpoint called - DISABLED')
  return NextResponse.json({
    canLogout: false,
    incompleteTasksCount: 0,
    message: 'Auto-logout feature is disabled'
  })
}

// Endpoint to trigger auto-logout after task completion - DISABLED
export async function PUT(request: NextRequest) {
  console.log('🚫 Auto-logout PUT endpoint called - DISABLED')
  return NextResponse.json({
    success: false,
    message: 'Auto-logout feature is disabled'
  })
}