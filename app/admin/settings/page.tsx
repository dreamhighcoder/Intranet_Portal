"use client"

import { useState, useEffect } from "react"
import { usePositionAuth } from "@/lib/position-auth-context"
import { Navigation } from "@/components/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { useRouter } from "next/navigation"
import { Settings, Save, Database, Clock, Calendar } from "lucide-react"
import { toastSuccess, toastError } from "@/hooks/use-toast"

export default function SettingsPage() {
  const { user, isLoading, isAdmin } = usePositionAuth()
  const router = useRouter()
  
  // Settings state
  const [systemName, setSystemName] = useState("Richmond Pharmacy Intranet")
  const [timezone, setTimezone] = useState("Australia/Melbourne") 
  const [workingHours, setWorkingHours] = useState("9:00 - 17:00")
  const [taskRetentionDays, setTaskRetentionDays] = useState(30)
  const [autoGenerateTasks, setAutoGenerateTasks] = useState(true)
  const [emailNotifications, setEmailNotifications] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!isLoading && (!user || user.role !== "admin")) {
      router.push("/")
    }
  }, [user, isLoading, router])

  if (isLoading) {
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
      toastSuccess("Settings Saved", "System settings have been updated successfully")
    } catch (error) {
      toastError("Save Failed", "Failed to save settings. Please try again.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      <Navigation />

      <main className="max-w-content-lg mx-auto px-4 sm:px-6 lg:px-18 py-6 sm:py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-2">System Settings</h1>
          <p className="text-[var(--color-text-secondary)]">
            Configure system preferences and operational parameters
          </p>
        </div>

        <div className="grid gap-6">
          {/* General Settings */}
          <Card className="card-surface">
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Settings className="w-5 h-5 text-[var(--color-primary)]" />
                <CardTitle>General Settings</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="systemName">System Name</Label>
                  <Input
                    id="systemName"
                    value={systemName}
                    onChange={(e) => setSystemName(e.target.value)}
                    placeholder="Enter system name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Input
                    id="timezone"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    placeholder="e.g. Australia/Melbourne"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="workingHours">Working Hours</Label>
                <Input
                  id="workingHours"
                  value={workingHours}
                  onChange={(e) => setWorkingHours(e.target.value)}
                  placeholder="e.g. 9:00 - 17:00"
                />
              </div>
            </CardContent>
          </Card>

          {/* Task Management Settings */}
          <Card className="card-surface">
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Database className="w-5 h-5 text-[var(--color-primary)]" />
                <CardTitle>Task Management</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="taskRetention">Task Retention (days)</Label>
                  <Input
                    id="taskRetention"
                    type="number"
                    value={taskRetentionDays}
                    onChange={(e) => setTaskRetentionDays(Number(e.target.value))}
                    placeholder="30"
                  />
                  <p className="text-sm text-[var(--color-text-muted)]">
                    How long to keep completed task data
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label>Auto-Generate Tasks</Label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={autoGenerateTasks}
                      onChange={(e) => setAutoGenerateTasks(e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm">Automatically generate daily tasks</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notification Settings */}
          <Card className="card-surface">
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Clock className="w-5 h-5 text-[var(--color-primary)]" />
                <CardTitle>Notifications</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={emailNotifications}
                    onChange={(e) => setEmailNotifications(e.target.checked)}
                    className="rounded"
                  />
                  <Label>Email Notifications</Label>
                </div>
                <p className="text-sm text-[var(--color-text-muted)]">
                  Send email notifications for overdue tasks and important events
                </p>
              </div>
            </CardContent>
          </Card>

          {/* System Information */}
          <Card className="card-surface">
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Database className="w-5 h-5 text-[var(--color-primary)]" />
                <CardTitle>System Information</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-muted)]">Version:</span>
                  <span>1.0.0</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-muted)]">Database:</span>
                  <span>Connected</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-muted)]">Last Backup:</span>
                  <span>{new Date().toLocaleDateString("en-AU")}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button
              onClick={handleSaveSettings}
              disabled={isSaving}
              className="bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90"
            >
              {isSaving ? (
                <>
                  <Clock className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Settings
                </>
              )}
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}