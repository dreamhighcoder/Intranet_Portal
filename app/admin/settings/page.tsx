"use client"

import { useState, useEffect } from "react"
import { usePositionAuth } from "@/lib/position-auth-context"
import { Navigation } from "@/components/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { useRouter } from "next/navigation"
import {
  Save,
  Calendar,
  Globe,
  Shield,
  Server,
  CheckCircle,
  RefreshCw,
  Clock,
  Settings
} from "lucide-react"
import { TimezoneHealthCard } from "@/components/admin/timezone-health"
import { ResourceHubConfigManager } from "@/components/admin/ResourceHubConfigManager"
import { toastSuccess, toastError } from "@/hooks/use-toast"
import { authenticatedGet, authenticatedPost, authenticatedPut } from "@/lib/api-client"
import { getAustralianNow, AUSTRALIAN_TIMEZONE } from "@/lib/timezone-utils"
import { formatInTimeZone } from "date-fns-tz"

interface Category {
  id: string
  label: string
  emoji: string
  color: string
}

interface DocumentType {
  id: string
  label: string
  color: string
}

interface SystemSettings {
  timezone: string
  new_since_hour: string
  missed_cutoff_time: string
  auto_logout_enabled: boolean
  auto_logout_delay_minutes: number
  task_generation_days_ahead: number
  task_generation_days_behind: number
  working_days: string[]
  public_holiday_push_forward: boolean
  resource_hub_categories?: Category[]
  resource_hub_document_types?: DocumentType[]
}



interface SystemInfo {
  version: string
  nodeVersion: string
  platform: string
  uptime: string
  lastBackup: string
  databaseStatus: string
}

const TIMEZONE_OPTIONS = [
  { value: 'Australia/Sydney', label: 'Australia/Sydney (AEDT/AEST)' },
  { value: 'Australia/Melbourne', label: 'Australia/Melbourne (AEDT/AEST)' },
  { value: 'Australia/Brisbane', label: 'Australia/Brisbane (AEST)' },
  { value: 'Australia/Perth', label: 'Australia/Perth (AWST)' },
  { value: 'Australia/Adelaide', label: 'Australia/Adelaide (ACDT/ACST)' },
  { value: 'Australia/Darwin', label: 'Australia/Darwin (ACST)' },
  { value: 'Australia/Hobart', label: 'Australia/Hobart (AEDT/AEST)' }
]

const WORKING_DAYS_OPTIONS = [
  { value: 'monday', label: 'Monday' },
  { value: 'tuesday', label: 'Tuesday' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday', label: 'Thursday' },
  { value: 'friday', label: 'Friday' },
  { value: 'saturday', label: 'Saturday' },
  { value: 'sunday', label: 'Sunday' }
]

const GENERATION_DAYS_AHEAD_OPTIONS = [
  { value: 7, label: '7 Days' },
  { value: 30, label: '1 Month' },
  { value: 90, label: '3 Months' },
  { value: 180, label: '6 Months' },
  { value: 365, label: '1 Year' },
  { value: 999999, label: 'Unlimit' }
]

const GENERATION_DAYS_BEHIND_OPTIONS = [
  { value: 0, label: '0 Day' },
  { value: 7, label: '7 Days' },
  { value: 30, label: '1 Months' }
]

export default function SettingsPage() {
  const { user, isLoading: authLoading, isAdmin } = usePositionAuth()
  const router = useRouter()

  // Settings state
  const [settings, setSettings] = useState<SystemSettings>({
    timezone: 'Australia/Hobart',
    new_since_hour: '00:00',
    missed_cutoff_time: '23:59',
    auto_logout_enabled: true,
    auto_logout_delay_minutes: 1,
    task_generation_days_ahead: 999999,
    task_generation_days_behind: 0,
    working_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
    public_holiday_push_forward: true,
    resource_hub_categories: [],
    resource_hub_document_types: []
  })

  const [resourceHubCategories, setResourceHubCategories] = useState<Category[]>([])
  const [resourceHubDocumentTypes, setResourceHubDocumentTypes] = useState<DocumentType[]>([])

  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  useEffect(() => {
    if (!authLoading && (!user || user.role !== "admin")) {
      router.push("/")
    }
  }, [user, authLoading, router])

  useEffect(() => {
    if (user && isAdmin) {
      loadSettings()
      loadSystemInfo()
    }
  }, [user, isAdmin])

  const loadSettings = async () => {
    try {
      const response = await authenticatedGet('/api/admin/settings')

      if (response && response.success) {
        setSettings(response.data)
        // Load resource hub config separately with normalization
        if (response.data.resource_hub_categories) {
          const cats = Array.isArray(response.data.resource_hub_categories) 
            ? response.data.resource_hub_categories 
            : []
          setResourceHubCategories(cats)
        }
        if (response.data.resource_hub_document_types) {
          let types: DocumentType[] = []
          const data = response.data.resource_hub_document_types
          
          if (Array.isArray(data)) {
            types = data
          } else if (typeof data === 'object' && data !== null) {
            // Convert object format to array format if needed
            types = Object.entries(data).map(([id, item]: [string, any]) => ({
              id,
              label: item.label || '',
              color: item.color || ''
            }))
          }
          
          setResourceHubDocumentTypes(types)
        }
      } else {
        throw new Error(response?.error || 'Failed to load settings')
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
      toastError("Load Failed", "Failed to load system settings")
    }
  }



  const loadSystemInfo = async () => {
    try {
      // Get basic system info
      const now = getAustralianNow()
      const info: SystemInfo = {
        version: '1.2.0',
        platform: 'Next.js 15.2.4 on Windows',
        nodeVersion: 'Node.js v20.x.x',
        databaseStatus: 'Connected',
        lastBackup: formatInTimeZone(now, AUSTRALIAN_TIMEZONE, 'PPp'),
        systemTime: formatInTimeZone(now, AUSTRALIAN_TIMEZONE, 'PPp'),
        memoryUsage: {
          used: '2.1 GB',
          total: '8.0 GB',
          percentage: 26
        },
        diskSpace: {
          used: '45.2 GB',
          available: '120.8 GB'
        }
      }
      setSystemInfo(info)
      setIsLoading(false)
    } catch (error) {
      console.error('Failed to load system info:', error)
      setIsLoading(false)
    }
  }



  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary)] mx-auto"></div>
          <p className="mt-2 text-[var(--color-text-secondary)]">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user || !isAdmin) return null

  const handleSaveSettings = async () => {
    setIsSaving(true)
    try {
      // Debug logging - Check all fields are present
      console.log('🔍 handleSaveSettings - Current state:')
      console.log('  resourceHubCategories:', JSON.stringify(resourceHubCategories, null, 2))
      console.log('  resourceHubCategories type:', typeof resourceHubCategories)
      console.log('  resourceHubCategories is array:', Array.isArray(resourceHubCategories))
      console.log('  resourceHubCategories count:', Array.isArray(resourceHubCategories) ? resourceHubCategories.length : 0)
      
      if (Array.isArray(resourceHubCategories)) {
        resourceHubCategories.forEach((cat, idx) => {
          console.log(`    Category ${idx}: id="${cat.id}", label="${cat.label}", emoji="${cat.emoji}", color="${cat.color}"`)
          if (!cat.label) console.warn(`    ⚠️ Category ${idx} has empty label!`)
        })
      }
      
      console.log('  resourceHubDocumentTypes:', JSON.stringify(resourceHubDocumentTypes, null, 2))
      console.log('  resourceHubDocumentTypes type:', typeof resourceHubDocumentTypes)
      console.log('  resourceHubDocumentTypes is array:', Array.isArray(resourceHubDocumentTypes))
      console.log('  resourceHubDocumentTypes count:', Array.isArray(resourceHubDocumentTypes) ? resourceHubDocumentTypes.length : 0)
      
      if (Array.isArray(resourceHubDocumentTypes)) {
        resourceHubDocumentTypes.forEach((type, idx) => {
          console.log(`    Type ${idx}: id="${type.id}", label="${type.label}", color="${type.color}"`)
          if (!type.label) console.warn(`    ⚠️ Type ${idx} has empty label!`)
        })
      }
      
      // Create payload without resource hub fields from settings, then add them explicitly
      const { resource_hub_categories, resource_hub_document_types, ...settingsWithoutResourceHub } = settings
      
      const payloadToSave = {
        ...settingsWithoutResourceHub,
        resource_hub_categories: resourceHubCategories || [],
        resource_hub_document_types: resourceHubDocumentTypes || []
      }

      console.log('🔍 handleSaveSettings - Final payload to send to API:')
      console.log('  resource_hub_categories:', JSON.stringify(payloadToSave.resource_hub_categories, null, 2))
      console.log('  resource_hub_categories count:', Array.isArray(payloadToSave.resource_hub_categories) ? payloadToSave.resource_hub_categories.length : 0)
      console.log('  resource_hub_document_types:', JSON.stringify(payloadToSave.resource_hub_document_types, null, 2))
      console.log('  resource_hub_document_types count:', Array.isArray(payloadToSave.resource_hub_document_types) ? payloadToSave.resource_hub_document_types.length : 0)

      const response = await authenticatedPut('/api/admin/settings', payloadToSave)

      if (response && response.success) {
        // Update last refresh time
        setLastRefresh(getAustralianNow())

        // Dispatch event to notify other components that settings have changed
        window.dispatchEvent(new CustomEvent('systemSettingsChanged'))

        toastSuccess("Settings Saved", response.message || "System settings have been updated successfully")
      } else {
        throw new Error(response?.error || 'Failed to save settings')
      }
    } catch (error) {
      console.error('Save settings error:', error)
      toastError("Save Failed", "Failed to save settings. Please try again.")
    } finally {
      setIsSaving(false)
    }
  }

  const getSettingDescription = (key: string): string => {
    const descriptions: Record<string, string> = {
      timezone: 'System timezone for all date/time operations',
      new_since_hour: 'Hour when tasks become "new" (HH:mm format)',
      missed_cutoff_time: 'Time when tasks become "missed" (HH:mm format)',
      auto_logout_enabled: 'Enable automatic logout for inactive users',
      auto_logout_delay_minutes: 'Minutes of inactivity before auto logout',
      task_generation_days_ahead: 'Days ahead to generate task instances',
      task_generation_days_behind: 'Days behind to generate task instances',
      working_days: 'Days of the week when tasks are active',
      public_holiday_push_forward: 'Push tasks forward when they fall on public holidays'
    }
    return descriptions[key] || 'System setting'
  }

  const updateSetting = <K extends keyof SystemSettings>(key: K, value: SystemSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  const toggleWorkingDay = (day: string) => {
    const currentDays = settings.working_days
    const newDays = currentDays.includes(day)
      ? currentDays.filter(d => d !== day)
      : [...currentDays, day]
    updateSetting('working_days', newDays)
  }



  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      <Navigation />

      <main className="max-w-content-lg mx-auto px-4 sm:px-6 lg:px-18 py-6 sm:py-8">
        <div className="mb-6 sm:mb-8">
          <div className="pharmacy-gradient rounded-lg p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-2">System Settings</h1>
                <p className="text-white/90">Configure system preferences and operational parameters for the Richmond Pharmacy Intranet Portal</p>
              </div>
              <div className="flex items-center space-x-4">
                <Settings className="w-8 h-8 text-white" />
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6 sm:mb-8">
          {/* Timezone Configuration */}
          <Card className="card-surface gap-3 sm:px-6 sm:py-4 mb-6">
            <CardHeader className="px-0 pt-2">
              <div className="flex items-center space-x-2">
                <Globe className="w-5 h-5 text-[var(--color-primary)]" />
                <CardTitle className="text-base sm:text-lg">Timezone & Regional Settings</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-0">
              <div className="items-center p-4 rounded-md border shadow-sm space-y-2">
                <Label htmlFor="timezone">System Timezone</Label>
                <Select
                  value={settings.timezone}
                  onValueChange={(value) => updateSetting('timezone', value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select timezone" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONE_OPTIONS.map((tz) => (
                      <SelectItem key={tz.value} value={tz.value}>
                        {tz.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-[var(--color-text-muted)]">
                  All dates and times will be displayed in this timezone
                </p>
              </div>

              <div className="items-center p-4 rounded-md border shadow-sm space-y-2">
                <Label>Working Days</Label>
                <div className="flex flex-wrap gap-2">
                  {WORKING_DAYS_OPTIONS.map((day) => (
                    <Button
                      key={day.value}
                      variant={settings.working_days.includes(day.value) ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleWorkingDay(day.value)}
                      className={`text-xs ${settings.working_days.includes(day.value) ? 'text-white' : ''}`}
                    >
                      {day.label}
                    </Button>
                  ))}
                </div>
                <p className="text-sm text-[var(--color-text-muted)]">
                  Tasks will only be generated on selected days
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Task Management Settings */}
          <Card className="card-surface gap-3 sm:px-6 sm:py-4 mb-6">
            <CardHeader className="px-0 pt-2">
              <div className="flex items-center space-x-2">
                <Calendar className="w-5 h-5 text-[var(--color-primary)]" />
                <CardTitle className="text-base sm:text-lg">Task Management</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 p-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                <div className="space-y-2 p-4 border rounded-lg shadow-sm">
                  <Label htmlFor="newSinceHour">New Task Hour</Label>
                  <Input
                    id="newSinceHour"
                    type="time"
                    value={settings.new_since_hour}
                    onChange={(e) => updateSetting('new_since_hour', e.target.value)}
                  />
                  <p className="text-sm text-[var(--color-text-muted)]">
                    Time tasks marked "New" daily
                  </p>
                </div>

                <div className="space-y-2 p-4 border rounded-lg shadow-sm">
                  <Label htmlFor="missedCutoffTime">Missed Cutoff Time</Label>
                  <Input
                    id="missedCutoffTime"
                    type="time"
                    value={settings.missed_cutoff_time}
                    onChange={(e) => updateSetting('missed_cutoff_time', e.target.value)}
                  />
                  <p className="text-sm text-[var(--color-text-muted)]">
                    Time incomplete tasks marked "Missed"
                  </p>
                </div>
                <div className="space-y-2 p-4 border rounded-lg shadow-sm">
                  <Label htmlFor="daysAhead">Generation Days Ahead</Label>
                  <Select
                    value={settings.task_generation_days_ahead.toString()}
                    onValueChange={(value) => updateSetting('task_generation_days_ahead', Number(value))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select days ahead" />
                    </SelectTrigger>
                    <SelectContent>
                      {GENERATION_DAYS_AHEAD_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value.toString()}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-[var(--color-text-muted)]">
                    Days ahead to create task instances
                  </p>
                </div>
                <div className="space-y-2 p-4 border rounded-lg shadow-sm">
                  <Label htmlFor="daysBehind">Generation Days Behind</Label>
                  <Select
                    value={settings.task_generation_days_behind.toString()}
                    onValueChange={(value) => updateSetting('task_generation_days_behind', Number(value))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select days behind" />
                    </SelectTrigger>
                    <SelectContent>
                      {GENERATION_DAYS_BEHIND_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value.toString()}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-[var(--color-text-muted)]">
                    Days back to create task instances
                  </p>
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg shadow-sm">
                  <div className="space-y-1">
                    <Label className="text-base font-medium">Public Holiday Handling</Label>
                    <p className="text-sm text-[var(--color-text-muted)]">
                      Automatically move tasks when on public holidays
                    </p>
                  </div>
                  <Switch
                    checked={settings.public_holiday_push_forward}
                    onCheckedChange={(checked) => updateSetting('public_holiday_push_forward', checked)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Security & Session Settings */}
          <Card className="card-surface gap-3 sm:px-6 sm:py-4 mb-6">
            <CardHeader className="px-0 pt-2">
              <div className="flex items-center space-x-2">
                <Shield className="w-5 h-5 text-[var(--color-primary)]" />
                <CardTitle className="text-base sm:text-lg">Security & Sessions</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-0">
              <div className="flex items-center justify-between p-4 border rounded-lg shadow-sm">
                <div className="space-y-1">
                  <Label className="text-base font-medium mb-2">Auto Logout</Label>
                  <p className="text-sm text-[var(--color-text-muted)]">
                    Automatically log out inactive users for security
                  </p>
                </div>
                <Switch
                  checked={settings.auto_logout_enabled}
                  onCheckedChange={(checked) => updateSetting('auto_logout_enabled', checked)}
                />
              </div>

              {settings.auto_logout_enabled && (
                <div className="space-y-2">
                  <Label htmlFor="autoLogoutDelay">Auto Logout Delay (minutes)</Label>
                  <Input
                    id="autoLogoutDelay"
                    type="number"
                    min="1"
                    max="60"
                    value={settings.auto_logout_delay_minutes}
                    onChange={(e) => updateSetting('auto_logout_delay_minutes', Number(e.target.value))}
                  />
                  <p className="text-sm text-[var(--color-text-muted)]">
                    Minutes of inactivity before automatic logout
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Resource Hub Configuration */}
          <ResourceHubConfigManager
            categories={resourceHubCategories}
            documentTypes={resourceHubDocumentTypes}
            onCategoriesChange={(cats) => {
              console.log('📢 Settings page: onCategoriesChange called with:', JSON.stringify(cats, null, 2))
              setResourceHubCategories(cats)
            }}
            onDocumentTypesChange={(types) => {
              console.log('📢 Settings page: onDocumentTypesChange called with:', JSON.stringify(types, null, 2))
              setResourceHubDocumentTypes(types)
            }}
          />

          {/* Timezone Health Check */}
          <TimezoneHealthCard />

          {/* System Information */}
          <Card className="card-surface gap-3 sm:px-6 sm:py-4 mb-6">
            <CardHeader className="px-0 pt-2">
              <div className="flex items-center space-x-2">
                <Server className="w-5 h-5 text-[var(--color-primary)]" />
                <CardTitle className="text-base sm:text-lg">System Information</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 p-0">
              {systemInfo ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="space-y-3 p-4 border rounded-lg shadow-sm">
                    <div className="flex justify-between">
                      <span className="text-[var(--color-text-muted)]">Version:</span>
                      <span className="font-medium">{systemInfo.version}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--color-text-muted)]">Platform:</span>
                      <span className="font-medium">{systemInfo.platform}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--color-text-muted)]">Runtime:</span>
                      <span className="font-medium">{systemInfo.nodeVersion}</span>
                    </div>
                  </div>
                  <div className="space-y-3 p-4 border rounded-lg shadow-sm">
                    <div className="flex justify-between">
                      <span className="text-[var(--color-text-muted)]">Database:</span>
                      <span className="font-medium flex items-center">
                        <CheckCircle className="w-4 h-4 text-green-500 mr-1" />
                        {systemInfo.databaseStatus}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--color-text-muted)]">Last Backup:</span>
                      <span className="font-medium">{systemInfo.lastBackup}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--color-text-muted)]">System Time:</span>
                      <span className="font-medium">{formatInTimeZone(lastRefresh, AUSTRALIAN_TIMEZONE, 'PPp')}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-[var(--color-text-secondary)]">Loading system information...</p>
              )}
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-center sm:justify-end space-x-3">
            <Button
              variant="outline"
              onClick={() => {
                loadSettings()
                toastSuccess("Reloaded", "Settings have been reloaded from the database")
              }}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Reset<span className="hidden sm:inline">Changes</span>
            </Button>
            <Button
              onClick={handleSaveSettings}
              disabled={isSaving}
              className="bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 text-white"
            >
              {isSaving ? (
                <>
                  <Clock className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save<span className="hidden sm:inline">Settings</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}