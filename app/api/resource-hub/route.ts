import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { requireAuth } from '@/lib/auth-middleware'
import { getAustralianNow } from '@/lib/timezone-utils'

// GET - Fetch all policy documents (public access)
export async function GET(request: NextRequest) {
  try {
    const { data: documents, error } = await supabaseServer
      .from('policy_documents')
      .select('*')
      .order('category', { ascending: true })
      .order('title', { ascending: true })

    if (error) {
      console.error('Error fetching policy documents:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    // Add is_new flag for documents created within the last 12 hours (Australian time)
    const now = getAustralianNow()
    const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000)

    const documentsWithNewFlag = documents.map(doc => ({
      ...doc,
      is_new: new Date(doc.created_at) >= twelveHoursAgo
    }))

    return NextResponse.json({ success: true, data: documentsWithNewFlag })
  } catch (error: any) {
    console.error('Error in GET /api/resource-hub:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// POST - Create a new policy document (admin only)
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    if (!user || user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { title, document_url, category, document_type, description, linked_tasks } = body

    // Validate required fields
    if (!title || !document_url || !category) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Determine the correct document_type based on linked_tasks
    // If linked_tasks is provided and has items, it should be 'task-instruction'
    // Otherwise, use the provided document_type or default to 'general-policy'
    const finalDocumentType = (linked_tasks && Array.isArray(linked_tasks) && linked_tasks.length > 0)
      ? 'task-instruction'
      : (document_type || 'general-policy')

    // Insert the document
    const { data: document, error: docError } = await supabaseServer
      .from('policy_documents')
      .insert({
        title,
        document_url,
        category,
        document_type: finalDocumentType,
        description: description || null
      })
      .select()
      .single()

    if (docError) {
      console.error('Error creating policy document:', docError)
      return NextResponse.json(
        { success: false, error: docError.message },
        { status: 500 }
      )
    }

    // Link to tasks if provided
    if (linked_tasks && Array.isArray(linked_tasks) && linked_tasks.length > 0) {
      const links = linked_tasks.map((taskId: string) => ({
        master_task_id: taskId,
        policy_document_id: document.id
      }))

      const { error: linkError } = await supabaseServer
        .from('task_document_links')
        .insert(links)

      if (linkError) {
        console.error('Error linking tasks to document:', linkError)
        // Don't fail the whole operation, just log the error
      }
    }

    return NextResponse.json({ success: true, data: document })
  } catch (error: any) {
    console.error('Error in POST /api/resource-hub:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}