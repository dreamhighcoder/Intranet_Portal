"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/lib/auth"
import { Navigation } from "@/components/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { mockSystemSettings } from "@/lib/mock-data"
import { useRouter } from "next/navigation"
import type { SystemSettings } from "@/lib/types"

export default function SettingsPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const [settings, setSettings] = useState<SystemSettings>(mockSystemSettings)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!isLoading && (!user || user.role !== "admin")) {
      router.push("/")
    }
  }, [user, isLoading, router])

  const handleSave = async () => {
    setIsSaving(true)

    // Mock save operation
    await new Promise((resolve) => setTimeout(resolve, 1000))

    console.log("Saving settings:", settings)
    setIsSaving(false)

    // Show success message (in real app, use toast)
    alert("Settings saved successfully!")
  }

  const handleSettingChange = (field: keyof SystemSettings, value: string) => {
    setSettings((prev) => ({
      ...prev,
      [field]: value,
      updated_at: new Date().toISOString(),
    }))
  }

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

  if (!user || user.role !== "admin") return null

  const timezones = [
    { value: "Australia/Sydney", label: "Sydney (AEDT/AEST)" },
    { value: "Australia/Melbourne", label: "Melbourne (AEDT/AEST)" },
    { value: "Australia/Brisbane", label: "Brisbane (AEST)" },
    { value: "Australia/Perth", label: "Perth (AWST)" },
    { value: "Australia/Adelaide", label: "Adelaide (ACDT/ACST)" },
    { value: "Australia/Darwin", label: "Darwin (ACST)" },
    { value: "Australia/Hobart", label: "Hobart (AEDT/AEST)" },
  ]

  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      <Navigation />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-2">System Settings</h1>
          <p className="text-[var(--color-text-secondary)]">
            Configure system-wide settings for the pharmacy intranet portal
          </p>
        </div>

        <div className="space-y-6">
          {/* General Settings */}
          <Card className="card-surface">
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="timezone">System Timezone</Label>
                <Select value={settings.timezone} onValueChange={(value) => handleSettingChange("timezone", value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {timezones.map((tz) => (
                      <SelectItem key={tz.value} value={tz.value}>
                        {tz.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                  All task scheduling and timestamps will use this timezone
                </p>
              </div>

              <div>
                <Label htmlFor="new-since-hour">"New Since" Hour</Label>
                <Input
                  id="new-since-hour"
                  type="time"
                  value={settings.new_since_hour}
                  onChange={(e) => handleSettingChange("new_since_hour", e.target.value)}
                />
                <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                  Tasks created after this time will be shown as "new since" on the dashboard
                </p>
              </div>

              <div>
                <Label htmlFor="missed-cutoff">Missed Task Cutoff Time</Label>
                <Input
                  id="missed-cutoff"
                  type="time"
                  value={settings.missed_cutoff_time}
                  onChange={(e) => handleSettingChange("missed_cutoff_time", e.target.value)}
                />
                <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                  Tasks not completed by this time will be marked as "missed"
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Task Management Settings */}
          <Card className="card-surface">
            <CardHeader>
              <CardTitle>Task Management</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-[var(--color-text-primary)] mb-2">Task Scheduling</h4>
                  <ul className="text-sm text-[var(--color-text-secondary)] space-y-1">
                    <li>• Tasks are generated based on frequency settings</li>
                    <li>• Public holidays are automatically excluded</li>
                    <li>• Overdue tasks remain visible until completed</li>
                  </ul>
                </div>

                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-[var(--color-text-primary)] mb-2">Notifications</h4>
                  <ul className="text-sm text-[var(--color-text-secondary)] space-y-1">
                    <li>• Email notifications for overdue tasks</li>
                    <li>• Daily summary reports for managers</li>
                    <li>• Compliance alerts for missed critical tasks</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* System Information */}
          <Card className="card-surface">
            <CardHeader>
              <CardTitle>System Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <h4 className="font-medium text-[var(--color-text-primary)] mb-2">Version Information</h4>
                  <ul className="text-[var(--color-text-secondary)] space-y-1">
                    <li>Portal Version: 1.0.0</li>
                    <li>Database Version: PostgreSQL 15</li>
                    <li>Last Updated: {new Date(settings.updated_at).toLocaleDateString("en-AU")}</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-medium text-[var(--color-text-primary)] mb-2">Support</h4>
                  <ul className="text-[var(--color-text-secondary)] space-y-1">
                    <li>Technical Support: support@pharmacy.com</li>
                    <li>Documentation: Available in Help section</li>
                    <li>Emergency Contact: 1800-PHARMACY</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90"
            >
              {isSaving ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}
