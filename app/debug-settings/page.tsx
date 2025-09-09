'use client'

import { useEffect, useState } from 'react'
import { getSystemSettings, clearSettingsCache } from '@/lib/system-settings'
import { supabase } from '@/lib/supabase'

export default function DebugSettingsPage() {
  const [settings, setSettings] = useState<any>(null)
  const [rawData, setRawData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const testDirectQuery = async () => {
    setLoading(true)
    setError(null)
    
    try {
      console.log('🧪 Testing direct database query...')
      
      // Direct query to database
      const { data: directData, error: directError } = await supabase
        .from('system_settings')
        .select('*')
        .order('key')

      console.log('📊 Direct query result:', { directData, directError })
      setRawData(directData)

      if (directError) {
        throw directError
      }

      // Test the getSystemSettings function
      console.log('🧪 Testing getSystemSettings function...')
      clearSettingsCache() // Clear cache first
      const processedSettings = await getSystemSettings(true) // Force refresh
      
      console.log('📊 Processed settings:', processedSettings)
      setSettings(processedSettings)

    } catch (err: any) {
      console.error('❌ Test failed:', err)
      setError(err.message || 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    testDirectQuery()
  }, [])

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Debug System Settings</h1>
      
      <div className="space-y-6">
        <button 
          onClick={testDirectQuery}
          disabled={loading}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? 'Testing...' : 'Test Settings Loading'}
        </button>

        {error && (
          <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            <h3 className="font-bold">Error:</h3>
            <p>{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h2 className="text-xl font-semibold mb-3">Raw Database Data</h2>
            <div className="bg-gray-100 p-4 rounded overflow-auto max-h-96">
              <pre className="text-sm">
                {rawData ? JSON.stringify(rawData, null, 2) : 'Loading...'}
              </pre>
            </div>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-3">Processed Settings</h2>
            <div className="bg-gray-100 p-4 rounded overflow-auto max-h-96">
              <pre className="text-sm">
                {settings ? JSON.stringify(settings, null, 2) : 'Loading...'}
              </pre>
            </div>
          </div>
        </div>

        {settings && (
          <div className="p-4 bg-green-100 border border-green-400 text-green-700 rounded">
            <h3 className="font-bold">Auto-Logout Settings:</h3>
            <ul className="mt-2">
              <li><strong>Enabled:</strong> {settings.auto_logout_enabled ? 'Yes' : 'No'}</li>
              <li><strong>Delay (minutes):</strong> {settings.auto_logout_delay_minutes}</li>
            </ul>
          </div>
        )}

        <div className="text-sm text-gray-600">
          <p><strong>Instructions:</strong></p>
          <ol className="list-decimal list-inside mt-2 space-y-1">
            <li>Open browser console (F12)</li>
            <li>Click "Test Settings Loading" button</li>
            <li>Check console for detailed debug messages</li>
            <li>Compare raw database data with processed settings</li>
            <li>Verify auto-logout delay shows 1 minute (not 5)</li>
          </ol>
        </div>
      </div>
    </div>
  )
}