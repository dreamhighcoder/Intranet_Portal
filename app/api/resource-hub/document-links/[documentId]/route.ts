import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

// GET - Fetch all tasks linked to a specific document (public access)
export async function GET(
  request: NextRequest,
  { params }: { params: { documentId: string } }
) {
  try {
    const { data: links, error } = await supabaseServer
      .from('task_document_links')
      .select(`
        id,
        master_tasks (
          id,
          title,
          description,
          categories
        )
      `)
      .eq('policy_document_id', params.documentId)

    if (error) {
      console.error('Error fetching document task links:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    // Extract tasks from the links
    const tasks = links?.map((link: any) => link.master_tasks).filter(Boolean) || []

    // 🔥 CRITICAL: Disable caching to ensure real-time data updates for all users
    const response = NextResponse.json({ success: true, data: tasks })
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
    return response
  } catch (error: any) {
    console.error('Error in GET /api/resource-hub/document-links/[documentId]:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}