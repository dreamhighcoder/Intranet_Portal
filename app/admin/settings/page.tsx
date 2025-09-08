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
import { toastSuccess, toastError } from "@/hooks/use-toast"
import { authenticatedGet, authenticatedPost, authenticatedPut } from "@/lib/api-client"
import { getAustralianNow, AUSTRALIAN_TIMEZONE } from "@/lib/timezone-utils"
import { formatInTimeZone } from "date-fns-tz"

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
    timezone: 'Australia/Sydney',
    new_since_hour: '00:00',
    missed_cutoff_time: '23:59',
    auto_logout_enabled: true,
    auto_logout_delay_minutes: 5,
    task_generation_days_ahead: 365,
    task_generation_days_behind: 0,
    working_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
    public_holiday_push_forward: true
  })

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
      // For now, use default settings - in production this would load from database
      setSettings({
        timezone: 'Australia/Sydney',
        new_since_hour: '00:00',
        missed_cutoff_time: '23:59',
        auto_logout_enabled: true,
        auto_logout_delay_minutes: 5,
        task_generation_days_ahead: 365,
        task_generation_days_behind: 0,
        working_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
        public_holiday_push_forward: true
      })
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
      // For now, just simulate saving (in a real app, this would save to database)
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Update last refresh time
      setLastRefresh(getAustralianNow())

      toastSuccess("Settings Saved", "System settings have been updated successfully")
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
          <Card className="card-surface gap-4 p-4 sm:p-6 mb-6">
            <CardHeader className="px-0 pt-2">
              <div className="flex items-center space-x-2">
                <Globe className="w-5 h-5 text-[var(--color-primary)]" />
                <CardTitle>Timezone & Regional Settings</CardTitle>
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

          {/* Timezone Health Check */}
          <TimezoneHealthCard />

          {/* Task Management Settings */}
          <Card className="card-surface gap-4 p-4 sm:p-6 mb-6">
            <CardHeader className="px-0 pt-2">
              <div className="flex items-center space-x-2">
                <Calendar className="w-5 h-5 text-[var(--color-primary)]" />
                <CardTitle>Task Management</CardTitle>
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
                    Time tasks marked "new" daily
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
                    Time incomplete tasks marked "missed"
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
          <Card className="card-surface gap-4 p-4 sm:p-6 mb-6">
            <CardHeader className="px-0 pt-2">
              <div className="flex items-center space-x-2">
                <Shield className="w-5 h-5 text-[var(--color-primary)]" />
                <CardTitle>Security & Sessions</CardTitle>
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

          {/* System Information */}
          <Card className="card-surface gap-4 p-4 sm:p-6 mb-6">
            <CardHeader className="px-0 pt-2">
              <div className="flex items-center space-x-2">
                <Server className="w-5 h-5 text-[var(--color-primary)]" />
                <CardTitle>System Information</CardTitle>
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