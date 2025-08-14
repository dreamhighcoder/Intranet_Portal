"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { usePositionAuth } from "@/lib/position-auth-context"
import { Navigation } from "@/components/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TASK_CATEGORIES, TASK_FREQUENCIES, TASK_TIMINGS } from "@/lib/constants"
import { useRouter, useParams } from "next/navigation"
import type { MasterTask, Position } from "@/lib/types"
import { positionsApi, authenticatedGet, authenticatedPost, authenticatedPut } from "@/lib/api-client"

export default function TaskEditorPage() {
  const { user, isLoading, isAdmin } = usePositionAuth()
  const router = useRouter()
  const params = useParams()
  const taskId = params.params?.[0]
  const isEditing = !!taskId

  const [positions, setPositions] = useState<Position[]>([])
  const [isLoadingData, setIsLoadingData] = useState(true)
  const [formData, setFormData] = useState<Partial<MasterTask>>({
    title: "",
    description: "",
    position_id: "",
    frequency: "every_day",
    timing: "morning",
    default_due_time: "09:00",
    category: "Compliance",
    publish_status: "draft",
    sticky_once_off: false,
    allow_edit_when_locked: false,
  })

  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!isLoading && (!user || !isAdmin)) {
      router.push("/")
    }
  }, [user, isLoading, router, isAdmin])

  useEffect(() => {
    async function fetchData() {
      if (!isAdmin) return
      
      try {
        // Fetch positions
        const positionsData = await positionsApi.getAll()
        if (positionsData) {
          setPositions(positionsData)
        }

        // Fetch existing task if editing
        if (isEditing && taskId) {
          const taskData = await authenticatedGet(`/api/master-tasks/${taskId}`)
          if (taskData) {
            setFormData(taskData)
          } else {
            console.error('Task not found')
            router.push('/admin/master-tasks')
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setIsLoadingData(false)
      }
    }

    fetchData()
  }, [user, isEditing, taskId, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)

    try {
      const result = isEditing 
        ? await authenticatedPut(`/api/master-tasks/${taskId}`, formData)
        : await authenticatedPost('/api/master-tasks', formData)

      if (result) {
        console.log('Task saved:', result)
        router.push("/admin/master-tasks")
      } else {
        throw new Error('Failed to save task')
      }
    } catch (error) {
      console.error('Error saving task:', error)
      alert(`Failed to save task: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsSaving(false)
    }
  }

  const handleInputChange = (field: keyof MasterTask, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  if (isLoading || isLoadingData) {
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

  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      <Navigation />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-2">
            {isEditing ? "Edit Task" : "Create New Task"}
          </h1>
          <p className="text-[var(--color-text-secondary)]">
            {isEditing ? "Update task template settings" : "Create a new task template for the checklist system"}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Form */}
            <div className="lg:col-span-2 space-y-6">
              <Card className="card-surface">
                <CardHeader>
                  <CardTitle>Basic Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="title">Task Title *</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => handleInputChange("title", e.target.value)}
                      placeholder="Enter task title"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => handleInputChange("description", e.target.value)}
                      placeholder="Detailed task instructions"
                      rows={4}
                    />
                  </div>

                  <div>
                    <Label htmlFor="category">Category *</Label>
                    <Select value={formData.category} onValueChange={(value) => handleInputChange("category", value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {TASK_CATEGORIES.map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              <Card className="card-surface">
                <CardHeader>
                  <CardTitle>Assignment & Scheduling</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="position">Responsibility (Position) *</Label>
                    <Select
                      value={formData.position_id}
                      onValueChange={(value) => handleInputChange("position_id", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select position" />
                      </SelectTrigger>
                      <SelectContent>
                        {positions.map((position) => (
                          <SelectItem key={position.id} value={position.id}>
                            {position.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="frequency">Frequency *</Label>
                    <Select value={formData.frequency} onValueChange={(value) => handleInputChange("frequency", value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select frequency" />
                      </SelectTrigger>
                      <SelectContent>
                        {TASK_FREQUENCIES.map((freq) => (
                          <SelectItem key={freq.value} value={freq.value}>
                            {freq.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="timing">Timing *</Label>
                    <Select value={formData.timing} onValueChange={(value) => handleInputChange("timing", value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select timing" />
                      </SelectTrigger>
                      <SelectContent>
                        {TASK_TIMINGS.map((timing) => (
                          <SelectItem key={timing.value} value={timing.value}>
                            {timing.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="due-time">Default Due Time *</Label>
                    <Input
                      id="due-time"
                      type="time"
                      value={formData.default_due_time}
                      onChange={(e) => handleInputChange("default_due_time", e.target.value)}
                      required
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              <Card className="card-surface">
                <CardHeader>
                  <CardTitle>Publishing</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="publish-status">Publish Status</Label>
                    <Select
                      value={formData.publish_status}
                      onValueChange={(value) => handleInputChange("publish_status", value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="delay-date">Publish Delay Date</Label>
                    <Input
                      id="delay-date"
                      type="date"
                      value={formData.publish_delay_date || ""}
                      onChange={(e) => handleInputChange("publish_delay_date", e.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="card-surface">
                <CardHeader>
                  <CardTitle>Advanced Options</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="sticky-once-off" className="text-sm">
                      Sticky Once Off
                    </Label>
                    <Switch
                      id="sticky-once-off"
                      checked={formData.sticky_once_off}
                      onCheckedChange={(checked) => handleInputChange("sticky_once_off", checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="allow-edit" className="text-sm">
                      Allow Edit When Locked
                    </Label>
                    <Switch
                      id="allow-edit"
                      checked={formData.allow_edit_when_locked}
                      onCheckedChange={(checked) => handleInputChange("allow_edit_when_locked", checked)}
                    />
                  </div>
                </CardContent>
              </Card>

              <div className="flex flex-col space-y-2">
                <Button
                  type="submit"
                  disabled={isSaving}
                  className="bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90"
                >
                  {isSaving ? "Saving..." : isEditing ? "Update Task" : "Create Task"}
                </Button>
                <Button type="button" variant="outline" onClick={() => router.push("/admin/master-tasks")}>
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </form>
      </main>
    </div>
  )
}
