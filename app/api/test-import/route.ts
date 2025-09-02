import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  console.log('Test Import - API route called')
  
  try {
    console.log('Test Import - Parsing form data...')
    const formData = await request.formData()
    console.log('Test Import - Form data entries:', Array.from(formData.entries()).map(([key, value]) => [key, typeof value, value instanceof File ? `File: ${value.name}, Size: ${value.size}` : value]))
    
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json({ success: false, message: 'No file uploaded' }, { status: 400 })
    }
    
    console.log('Test Import - File details:', {
      name: file.name,
      type: file.type,
      size: file.size
    })
    
    return NextResponse.json({
      success: true,
      message: 'File received successfully',
      fileInfo: {
        name: file.name,
        type: file.type,
        size: file.size
      }
    })
    
  } catch (error) {
    console.error('Test Import - Error:', error)
    return NextResponse.json(
      { success: false, message: 'Test failed', error: String(error) },
      { status: 500 }
    )
  }
}