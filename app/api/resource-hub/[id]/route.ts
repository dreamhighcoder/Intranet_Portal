import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { requireAuth } from '@/lib/auth-middleware'

// GET - Fetch a single policy document (public access)
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { data: document, error } = await supabaseServer
      .from('policy_documents')
      .select('*')
      .eq('id', params.id)
      .single()

    if (error) {
      console.error('Error fetching policy document:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data: document })
  } catch (error: any) {
    console.error('Error in GET /api/resource-hub/[id]:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// PUT - Update a policy document (admin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Use the document_type provided by frontend
    // The frontend handles all auto-change logic and user intent
    const finalDocumentType = document_type

    // Update the document
    const { data: document, error: docError } = await supabaseServer
      .from('policy_documents')
      .update({
        title,
        document_url,
        category,
        document_type: finalDocumentType,
        description: description || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', params.id)
      .select()
      .single()

    if (docError) {
      console.error('Error updating policy document:', docError)
      return NextResponse.json(
        { success: false, error: docError.message },
        { status: 500 }
      )
    }

    // Update task links if provided
    if (linked_tasks !== undefined) {
      // Delete existing links
      await supabaseServer
        .from('task_document_links')
        .delete()
        .eq('policy_document_id', params.id)

      // Insert new links
      if (Array.isArray(linked_tasks) && linked_tasks.length > 0) {
        const links = linked_tasks.map((taskId: string) => ({
          master_task_id: taskId,
          policy_document_id: params.id
        }))

        const { error: linkError } = await supabaseServer
          .from('task_document_links')
          .insert(links)

        if (linkError) {
          console.error('Error linking tasks to document:', linkError)
        }
      }
    }

    return NextResponse.json({ success: true, data: document })
  } catch (error: any) {
    console.error('Error in PUT /api/resource-hub/[id]:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// DELETE - Delete a policy document (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth(request)
    if (!user || user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Delete the document (cascade will handle task_document_links)
    const { error } = await supabaseServer
      .from('policy_documents')
      .delete()
      .eq('id', params.id)

    if (error) {
      console.error('Error deleting policy document:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error in DELETE /api/resource-hub/[id]:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}