import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

// GET - Fetch all documents linked to a specific task (public access)
export async function GET(
  request: NextRequest,
  { params }: { params: { taskId: string } }
) {
  try {
    const { data: links, error } = await supabaseServer
      .from('task_document_links')
      .select(`
        id,
        policy_documents (
          id,
          title,
          document_url,
          category,
          document_type,
          description
        )
      `)
      .eq('master_task_id', params.taskId)

    if (error) {
      console.error('Error fetching task document links:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    // Extract documents from the links
    const documents = links?.map((link: any) => link.policy_documents).filter(Boolean) || []

    // 🔥 CRITICAL: Disable caching to ensure real-time data updates for all users
    const response = NextResponse.json({ success: true, data: documents })
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
    return response
  } catch (error: any) {
    console.error('Error in GET /api/resource-hub/task-links/[taskId]:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}