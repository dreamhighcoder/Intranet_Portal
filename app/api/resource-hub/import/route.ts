import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { requireAuth } from '@/lib/auth-middleware'
import * as XLSX from 'xlsx'



function normalizeCategoryKey(value: string): string {
  return value.toLowerCase().trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-')
}

function parseTaskDescriptions(linkTasksValue: any): string[] {
  if (!linkTasksValue) return []

  const value = String(linkTasksValue).trim()
  if (!value) return []

  // Split by common delimiters: newline, semicolon, or pipe
  const descriptions = value
    .split(/[\n;|]/)
    .map(desc => desc.trim())
    .filter(desc => desc.length > 0)

  return descriptions
}

// Helper function to normalize text for comparison (case-insensitive, trim whitespace)
function normalizeText(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, ' ')
}

// Helper function to normalize supported category values
function normalizeCategoryValue(categoryValue: any): string | null {
  if (!categoryValue) return null
  const normalizedKey = normalizeCategoryKey(String(categoryValue))
  if (!normalizedKey) return null

  if (normalizedKey === 'stock-control') return 'stock-control'
  if (normalizedKey === 'hr') return 'hr'
  if (normalizedKey === 'policies' || normalizedKey === 'policy') return 'policies'

  return null
}

// POST - Import policy documents from Excel (admin only)
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    if (!user || user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      )
    }

    // Read the Excel file
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json(worksheet)

    if (!data || data.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No data found in Excel file' },
        { status: 400 }
      )
    }

    console.log('📊 Excel Import - Processing', data.length, 'rows')

    // Fetch all master tasks once for matching
    const { data: allMasterTasks, error: tasksError } = await supabaseServer
      .from('master_tasks')
      .select('id, title, description')
    
    if (tasksError) {
      console.error('Error fetching master tasks:', tasksError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch master tasks for matching' },
        { status: 500 }
      )
    }

    console.log('📋 Loaded', allMasterTasks?.length || 0, 'master tasks for matching')

    // Create a map for quick task lookup by normalized description
    const tasksByDescription = new Map<string, string>()
    allMasterTasks?.forEach(task => {
      if (task.description) {
        const normalizedDesc = normalizeText(task.description)
        tasksByDescription.set(normalizedDesc, task.id)
      }
    })

    // Validate and prepare documents for insertion
    const documentsToInsert: Array<{
      title: string
      document_url: string
      category: string
      document_type: string
      description: string | null
      linkedTaskIds: string[]
      rowNum: number
    }> = []
    const errors: string[] = []

    for (let i = 0; i < data.length; i++) {
      const row: any = data[i]
      const rowNum = i + 2 // Excel row number (accounting for header)

      // Map common Excel column names (case-insensitive)
      const title = row['Document Title'] || row['title'] || row['Title']
      const documentUrl = row['Document Link'] || row['document_url'] || row['Document URL'] || row['URL']
      const rawCategory = row['Category'] || row['category']
      const category = rawCategory ? normalizeCategoryValue(rawCategory) : null
      const linkTasks = row['Link Tasks'] || row['Linked Tasks'] || row['link_tasks'] || row['linked_tasks']

      // Validate required fields (document_type is now optional, will be auto-determined)
      if (!title || !documentUrl || !category) {
        const missingFields = []
        if (!title) missingFields.push('Document Title')
        if (!documentUrl) missingFields.push('Document Link')
        if (!category) missingFields.push('Category')
        errors.push(`Row ${rowNum}: Missing required fields (${missingFields.join(', ')})`)
        continue
      }

      // Validate category
      const validCategories = [
        'hr', 'stock-control', 'policies'
      ]
      if (!validCategories.includes(category)) {
        errors.push(`Row ${rowNum}: Invalid category "${rawCategory}". Valid categories: ${validCategories.join(', ')}`)
        continue
      }

      // Parse and match task descriptions
      const taskDescriptions = parseTaskDescriptions(linkTasks)
      const linkedTaskIds: string[] = []
      const unmatchedDescriptions: string[] = []

      if (taskDescriptions.length > 0) {
        console.log(`📝 Row ${rowNum}: Matching ${taskDescriptions.length} task description(s)`)
        
        for (const desc of taskDescriptions) {
          const normalizedDesc = normalizeText(desc)
          const taskId = tasksByDescription.get(normalizedDesc)
          
          if (taskId) {
            linkedTaskIds.push(taskId)
            console.log(`  ✅ Matched: "${desc}" -> Task ID: ${taskId}`)
          } else {
            unmatchedDescriptions.push(desc)
            console.log(`  ⚠️ No match found for: "${desc}"`)
          }
        }

        if (unmatchedDescriptions.length > 0) {
          errors.push(`Row ${rowNum}: Could not match ${unmatchedDescriptions.length} task description(s): ${unmatchedDescriptions.join('; ')}`)
        }
      }

      // Auto-determine document_type based on linked tasks
      const documentType = linkedTaskIds.length > 0 ? 'task-instruction' : 'general-policy'

      documentsToInsert.push({
        title,
        document_url: documentUrl,
        category,
        document_type: documentType,
        description: row.description || row.Description || null,
        linkedTaskIds,
        rowNum
      })
    }

    if (documentsToInsert.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid documents to import', errors },
        { status: 400 }
      )
    }

    console.log('💾 Inserting', documentsToInsert.length, 'documents into database')

    // Insert documents
    const { data: insertedDocs, error: insertError } = await supabaseServer
      .from('policy_documents')
      .insert(
        documentsToInsert.map(doc => ({
          title: doc.title,
          document_url: doc.document_url,
          category: doc.category,
          document_type: doc.document_type,
          description: doc.description
        }))
      )
      .select()

    if (insertError) {
      console.error('Error importing policy documents:', insertError)
      return NextResponse.json(
        { success: false, error: insertError.message, errors },
        { status: 500 }
      )
    }

    console.log('✅ Inserted', insertedDocs?.length || 0, 'documents')

    // Create task-document links for documents with linked tasks
    let linksCreated = 0
    const linkErrors: string[] = []

    if (insertedDocs && insertedDocs.length > 0) {
      for (let i = 0; i < insertedDocs.length; i++) {
        const doc = insertedDocs[i]
        const docData = documentsToInsert[i]

        if (docData.linkedTaskIds.length > 0) {
          console.log(`🔗 Creating ${docData.linkedTaskIds.length} link(s) for document: ${doc.title}`)

          // Create links using correct column names: master_task_id and policy_document_id
          const linksToInsert = docData.linkedTaskIds.map(taskId => ({
            master_task_id: taskId,
            policy_document_id: doc.id
          }))

          const { error: linkError } = await supabaseServer
            .from('task_document_links')
            .insert(linksToInsert)

          if (linkError) {
            console.error(`Error creating links for document ${doc.id}:`, linkError)
            linkErrors.push(`Row ${docData.rowNum}: Failed to create task links - ${linkError.message}`)
          } else {
            linksCreated += linksToInsert.length
            console.log(`  ✅ Created ${linksToInsert.length} link(s)`)
          }
        }
      }
    }

    console.log('🎉 Import complete:', {
      documentsImported: insertedDocs?.length || 0,
      linksCreated,
      totalErrors: errors.length + linkErrors.length
    })

    return NextResponse.json({
      success: true,
      data: {
        imported: insertedDocs?.length || 0,
        linksCreated,
        errors: [...errors, ...linkErrors].length > 0 ? [...errors, ...linkErrors] : undefined
      }
    })
  } catch (error: any) {
    console.error('Error in POST /api/resource-hub/import:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}