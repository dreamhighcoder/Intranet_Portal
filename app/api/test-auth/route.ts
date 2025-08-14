import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-middleware'

export async function GET(request: NextRequest) {
  try {
    console.log('=== AUTH TEST START ===')
    console.log('Request URL:', request.url)
    console.log('Request headers:', Object.fromEntries([...request.headers.entries()]))
    
    const user = await getAuthUser(request)
    console.log('Auth user result:', user)
    
    if (user) {
      return NextResponse.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          position_id: user.position_id,
          display_name: user.display_name
        },
        message: 'Authentication successful'
      })
    } else {
      return NextResponse.json({
        success: false,
        message: 'Authentication failed - no user found'
      }, { status: 401 })
    }
  } catch (error) {
    console.error('Auth test error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Authentication test failed'
    }, { status: 500 })
  } finally {
    console.log('=== AUTH TEST END ===')
  }
}