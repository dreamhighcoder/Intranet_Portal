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

    // 🔥 CRITICAL: Disable caching to ensure real-time data updates for all users
    const response = NextResponse.json({ success: true, data: documentsWithNewFlag })
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
    return response
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

    // Log the incoming data for debugging
    console.log('📝 Creating policy document:', {
      title,
      category,
      document_type,
      linked_tasks_count: linked_tasks?.length || 0
    })

    // Use the document_type provided by frontend, or default to 'general-policy'
    // The frontend handles all auto-change logic and user intent
    const finalDocumentType = document_type || 'general-policy'
    
    console.log('📝 Final document_type:', finalDocumentType, '(from frontend:' , document_type, ')')

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
      console.error('❌ Error creating policy document:', {
        message: docError.message,
        code: docError.code,
        details: docError.details,
        hint: docError.hint
      })
      
      // Check if it's a constraint violation error
      if (docError.message?.includes('violates check constraint')) {
        console.error('⚠️ CHECK CONSTRAINT VIOLATION - The category or document_type value is not allowed by the database.')
        console.error('⚠️ This usually means the constraint needs to be dropped.')
        console.error('⚠️ Run this SQL in Supabase: ALTER TABLE policy_documents DROP CONSTRAINT IF EXISTS policy_documents_category_check;')
      }
      
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