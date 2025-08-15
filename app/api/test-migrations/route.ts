import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Use service role key for migrations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

export async function GET() {
  try {
    console.log('Running position password migration...')

    // Check if the password_hash column exists  
    const { data: columnCheck } = await supabaseAdmin
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_name', 'positions')
      .eq('column_name', 'password_hash')
      .single()

    const hasPasswordHashColumn = !!columnCheck

    console.log('password_hash column exists:', hasPasswordHashColumn)

    const results = []

    // Update existing positions with password hashes (only if column exists)
    if (hasPasswordHashColumn) {
      const passwordUpdates = [
        { name: 'Pharmacist (Primary)', password: 'pharmprim123' },
        { name: 'Pharmacist (Supporting)', password: 'pharmsup123' },
        { name: 'Pharmacy Assistants', password: 'assistant123' },
        { name: 'Dispensary Technicians', password: 'tech123' },
        { name: 'DAA Packers', password: 'packer123' },
        { name: 'Operational/Managerial', password: 'ops123' }
      ]
      
      for (const update of passwordUpdates) {
        const hashedPassword = Buffer.from(update.password).toString('base64')
        const { data, error } = await supabaseAdmin
          .from('positions')
          .update({ password_hash: hashedPassword })
          .eq('name', update.name)
          .select()

        if (error) {
          console.error(`Error updating ${update.name}:`, error)
          results.push({ position: update.name, success: false, error: error.message })
        } else {
          console.log(`Updated ${update.name} with password`)
          results.push({ position: update.name, success: true, updated: data?.length || 0 })
        }
      }
    } else {
      results.push({ 
        message: 'Skipped password updates - password_hash column does not exist',
        action: 'Please run the SQL migration first to add the password_hash column'
      })
    }

    // Add administrator position if it doesn't exist
    const { data: adminCheck } = await supabaseAdmin
      .from('positions')
      .select('id, name')
      .or('id.eq.administrator,name.ilike.%administrator%')
      .single()

    if (!adminCheck) {
      // Prepare insert data
      const insertData: any = {
        id: 'administrator',
        name: 'Administrator',
        description: 'System administrator with full access'
      }
      
      // Only add password_hash if the column exists
      if (hasPasswordHashColumn) {
        insertData.password_hash = Buffer.from('admin123').toString('base64')
      }

      const { data: adminData, error: adminError } = await supabaseAdmin
        .from('positions')
        .insert(insertData)
        .select()

      if (adminError) {
        console.error('Error creating administrator:', adminError)
        results.push({ position: 'Administrator', success: false, error: adminError.message })
      } else {
        console.log('Created Administrator position')
        results.push({ position: 'Administrator', success: true, created: true })
      }
    } else {
      // Update existing admin position with password (only if column exists)
      if (hasPasswordHashColumn) {
        const adminPassword = Buffer.from('admin123').toString('base64')
        const { error: updateAdminError } = await supabaseAdmin
          .from('positions')
          .update({ password_hash: adminPassword })
          .eq('id', adminCheck.id)

        if (updateAdminError) {
          results.push({ position: 'Administrator', success: false, error: updateAdminError.message })
        } else {
          results.push({ position: 'Administrator', success: true, updated: 1 })
        }
      } else {
        results.push({ position: 'Administrator', success: true, message: 'Found existing, but password_hash column missing' })
      }
    }

    // Get final positions list
    const { data: finalPositions, error: fetchError } = await supabaseAdmin
      .from('positions')
      .select('id, name, password_hash')
      .order('name')

    if (fetchError) {
      console.error('Error fetching final positions:', fetchError)
    }

    return NextResponse.json({
      success: true,
      message: 'Migration completed',
      results,
      positions: finalPositions?.map(p => ({
        id: p.id,
        name: p.name,
        hasPassword: !!p.password_hash
      }))
    })
  } catch (error) {
    console.error('Migration error:', error)
    return NextResponse.json(
      { error: 'Migration failed', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}