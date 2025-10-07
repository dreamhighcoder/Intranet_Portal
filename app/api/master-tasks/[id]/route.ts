import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { createClient } from '@supabase/supabase-js'
import { australianNowUtcISOString } from '@/lib/timezone-utils'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  console.log('Master task [id] GET - Starting for ID:', params.id)
  try {
    const user = await requireAuth(request)
    console.log('Master task [id] GET - Authentication successful for:', user.email)
    
    // Create admin Supabase client for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    const { data: masterTask, error } = await supabase
      .from('master_tasks')
      .select(`
        *,
        positions (
          id,
          name
        )
      `)
      .eq('id', params.id)
      .single()

    if (error || !masterTask) {
      console.error('Master task not found:', error)
      return NextResponse.json({ error: 'Master task not found' }, { status: 404 })
    }

    return NextResponse.json(masterTask)
  } catch (error) {
    if (error instanceof Error && error.message.includes('Authentication')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  console.log('Master task [id] PUT - Starting for ID:', params.id)
  
  try {
    const user = await requireAuth(request)
    console.log('Master task [id] PUT - Authentication successful for:', user.email)
    
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }
    
    // Create admin Supabase client for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    const body = await request.json()
    
    const {
      title,
      description,
      responsibility,
      categories,
      frequencies,
      timing,
      due_time,
      due_date,
      publish_status,
      publish_delay,
      start_date,
      end_date,
      sticky_once_off,
      allow_edit_when_locked,
      linked_documents,
      // Legacy fields for backward compatibility
      position_id,
      weekdays,
      months,
      default_due_time,
      category,
      publish_delay_date
    } = body

    console.log('Master task [id] PUT - Updating task')

    // Prepare data for update using new schema
    const updateData: any = {
      // Persist UTC timestamp derived from Australia/Hobart "now"
      updated_at: australianNowUtcISOString()
    }

    // Only add fields that are explicitly provided in the request
    if (title !== undefined) updateData.title = title
    if (description !== undefined) updateData.description = description
    if (timing !== undefined) updateData.timing = timing
    if (due_time !== undefined) updateData.due_time = due_time
    if (due_date !== undefined) updateData.due_date = due_date
    if (publish_status !== undefined) updateData.publish_status = publish_status
    if (publish_delay !== undefined) updateData.publish_delay = publish_delay
    if (responsibility !== undefined) updateData.responsibility = responsibility
    if (categories !== undefined) updateData.categories = categories
    if (sticky_once_off !== undefined) updateData.sticky_once_off = sticky_once_off
    if (allow_edit_when_locked !== undefined) updateData.allow_edit_when_locked = allow_edit_when_locked

    // Handle frequencies array
    if (frequencies !== undefined) {
      updateData.frequencies = frequencies
    }



    // Only add start_date and end_date if they have values
    if (start_date) {
      updateData.start_date = start_date
    }
    if (end_date) {
      updateData.end_date = end_date
    }



    // Get the current task to check if publish_status is changing
    const { data: currentTask, error: fetchError } = await supabase
      .from('master_tasks')
      .select('publish_status')
      .eq('id', params.id)
      .single()

    if (fetchError) {
      console.error('Error fetching current task:', fetchError)
      return NextResponse.json({ 
        error: 'Failed to fetch current task',
        details: fetchError.message
      }, { status: 500 })
    }

    let { data: masterTask, error } = await supabase
      .from('master_tasks')
      .update(updateData)
      .eq('id', params.id)
      .select('*')
      .single()

    if (error) {
      console.error('Error updating master task:', error)
      console.error('Error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      })
      
      // Return more detailed error information
      return NextResponse.json({ 
        error: 'Failed to update master task',
        details: error.message,
        code: error.code
      }, { status: 500 })
    }

    // Handle linked documents if provided
    if (linked_documents !== undefined) {
      try {
        console.log('Master task [id] PUT - Updating linked documents')
        
        // Get the list of previously linked documents before deletion
        const { data: previousLinks } = await supabase
          .from('task_document_links')
          .select('policy_document_id')
          .eq('master_task_id', params.id)
        
        const previousDocIds = previousLinks?.map(link => link.policy_document_id) || []
        
        // First, delete all existing links for this task
        const { error: deleteError } = await supabase
          .from('task_document_links')
          .delete()
          .eq('master_task_id', params.id)
        
        if (deleteError) {
          console.error('Master task [id] PUT - Error deleting existing document links:', deleteError)
        }
        
        // Then, insert new links if any
        if (linked_documents && linked_documents.length > 0) {
          const linkData = linked_documents.map((docId: string) => ({
            master_task_id: params.id,
            policy_document_id: docId
          }))
          
          const { error: insertError } = await supabase
            .from('task_document_links')
            .insert(linkData)
          
          if (insertError) {
            console.error('Master task [id] PUT - Error inserting document links:', insertError)
          } else {
            console.log('Master task [id] PUT - Successfully linked', linked_documents.length, 'documents')
            
            // Update document type to 'task-instruction' for newly linked documents
            try {
              const { error: updateError } = await supabase
                .from('policy_documents')
                .update({ document_type: 'task-instruction' })
                .in('id', linked_documents)
              
              if (updateError) {
                console.error('Master task [id] PUT - Error updating document types:', updateError)
              } else {
                console.log('Master task [id] PUT - Updated document types to task-instruction')
              }
            } catch (updateError) {
              console.error('Master task [id] PUT - Exception updating document types:', updateError)
            }
          }
        }
        
        // Check if any previously linked documents are no longer linked to any task
        // and update their type back to 'general-policy'
        if (previousDocIds.length > 0) {
          try {
            // Find documents that were unlinked
            const unlinkedDocIds = previousDocIds.filter(docId => !linked_documents?.includes(docId))
            
            if (unlinkedDocIds.length > 0) {
              // For each unlinked document, check if it's still linked to other tasks
              for (const docId of unlinkedDocIds) {
                const { data: remainingLinks } = await supabase
                  .from('task_document_links')
                  .select('id')
                  .eq('policy_document_id', docId)
                  .limit(1)
                
                // If no remaining links, update document type back to 'general-policy'
                if (!remainingLinks || remainingLinks.length === 0) {
                  const { error: revertError } = await supabase
                    .from('policy_documents')
                    .update({ document_type: 'general-policy' })
                    .eq('id', docId)
                  
                  if (revertError) {
                    console.error('Master task [id] PUT - Error reverting document type:', revertError)
                  } else {
                    console.log('Master task [id] PUT - Reverted document type to general-policy for:', docId)
                  }
                }
              }
            }
          } catch (revertError) {
            console.error('Master task [id] PUT - Exception reverting document types:', revertError)
          }
        }
      } catch (linkError) {
        console.error('Master task [id] PUT - Exception updating document links:', linkError)
        // Don't fail the task update if document linking fails
      }
    }

    // Check if task was just activated and trigger frequency logic immediately
    const wasActivated = currentTask.publish_status !== 'active' && publish_status === 'active'
    
    if (wasActivated) {
      try {
        console.log('Master task [id] PUT - Task was activated, triggering frequency logic')
        const { runNewDailyGeneration } = await import('@/lib/new-task-generator')
        const { getAustralianToday } = await import('@/lib/timezone-utils')
        
        // Generate instances for today and potentially future dates
        const generationResult = await runNewDailyGeneration(getAustralianToday(), {
          testMode: false,
          dryRun: false,
          forceRegenerate: false
        })
        
        console.log('Master task [id] PUT - Frequency logic triggered, generated instances:', generationResult.totalInstances)
      } catch (generationError) {
        console.error('Master task [id] PUT - Error triggering frequency logic:', generationError)
        // Don't fail the update if instance generation fails, but log the error
      }
    }

    console.log('Master task [id] PUT - Successfully updated task')
    return NextResponse.json(masterTask)
  } catch (error) {
    if (error instanceof Error && error.message.includes('Authentication')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  console.log('Master task [id] DELETE - Starting for ID:', params.id)
  try {
    const user = await requireAuth(request)
    console.log('Master task [id] DELETE - Authentication successful for:', user.email)
    
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }
    
    // Create admin Supabase client for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // First, delete all associated task instances
    console.log('Master task [id] DELETE - Deleting associated task instances')
    const { error: instancesError } = await supabase
      .from('task_instances')
      .delete()
      .eq('master_task_id', params.id)

    if (instancesError) {
      console.error('Error deleting task instances:', instancesError)
      return NextResponse.json({ error: 'Failed to delete associated task instances' }, { status: 500 })
    }

    // Then delete the master task
    console.log('Master task [id] DELETE - Deleting master task')
    const { error } = await supabase
      .from('master_tasks')
      .delete()
      .eq('id', params.id)

    if (error) {
      console.error('Error deleting master task:', error)
      return NextResponse.json({ error: 'Failed to delete master task' }, { status: 500 })
    }

    console.log('Master task [id] DELETE - Successfully deleted task and instances')
    return NextResponse.json({ message: 'Master task deleted successfully' })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Authentication')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}