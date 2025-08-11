"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth"
import { Navigation } from "@/components/navigation"
import { DateNavigator } from "@/components/date-navigator"
import { TaskFilters } from "@/components/task-filters"
import { TaskCard } from "@/components/task-card"
import { Card, CardContent } from "@/components/ui/card"
import { getTasksByPosition, getTaskCounts, calculateTaskStatus } from "@/lib/task-utils"
import type { TaskWithDetails } from "@/lib/types"

export default function ChecklistPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [currentDate, setCurrentDate] = useState(() => {
    return searchParams.get("date") || new Date().toISOString().split("T")[0]
  })

  const [selectedPosition, setSelectedPosition] = useState("all")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [selectedStatus, setSelectedStatus] = useState("all")
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login")
    }
  }, [user, isLoading, router])

  useEffect(() => {
    const dateParam = searchParams.get("date")
    if (dateParam && dateParam !== currentDate) {
      setCurrentDate(dateParam)
    }
  }, [searchParams, currentDate])

  const handleDateChange = (date: string) => {
    setCurrentDate(date)
    const params = new URLSearchParams(searchParams.toString())
    params.set("date", date)
    router.push(`/checklist?${params.toString()}`)
  }

  const handleTaskUpdate = () => {
    setRefreshKey((prev) => prev + 1)
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

  if (!user) return null

  const tasksByPosition = getTasksByPosition(currentDate)
  const taskCounts = getTaskCounts(currentDate)

  // Apply filters
  const filteredTasksByPosition: Record<string, TaskWithDetails[]> = {}

  Object.entries(tasksByPosition).forEach(([positionName, tasks]) => {
    const filteredTasks = tasks.filter((task) => {
      // Position filter
      if (selectedPosition !== "all" && task.position_id !== selectedPosition) {
        return false
      }

      // Category filter
      if (selectedCategory !== "all" && task.master_task.category !== selectedCategory) {
        return false
      }

      // Status filter
      if (selectedStatus !== "all") {
        const taskStatus = calculateTaskStatus(task)
        if (taskStatus !== selectedStatus) {
          return false
        }
      }

      return true
    })

    if (filteredTasks.length > 0) {
      filteredTasksByPosition[positionName] = filteredTasks
    }
  })

  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      <Navigation />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-2">
            Checklist —{" "}
            {new Date(currentDate).toLocaleDateString("en-AU", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </h1>
          <p className="text-[var(--color-text-secondary)]">
            {taskCounts.total} tasks • {taskCounts.done} completed • {taskCounts.overdue + taskCounts.missed} need
            attention
          </p>
        </div>

        {/* Date Navigator */}
        <div className="mb-6">
          <DateNavigator currentDate={currentDate} onDateChange={handleDateChange} />
        </div>

        {/* Filters */}
        <div className="mb-6">
          <TaskFilters
            selectedPosition={selectedPosition}
            selectedCategory={selectedCategory}
            selectedStatus={selectedStatus}
            onPositionChange={setSelectedPosition}
            onCategoryChange={setSelectedCategory}
            onStatusChange={setSelectedStatus}
          />
        </div>

        {/* Task Sections by Position */}
        <div className="space-y-8">
          {Object.keys(filteredTasksByPosition).length === 0 ? (
            <Card className="card-surface">
              <CardContent className="py-12 text-center">
                <p className="text-[var(--color-text-secondary)] text-lg">No tasks found for the selected filters.</p>
              </CardContent>
            </Card>
          ) : (
            Object.entries(filteredTasksByPosition).map(([positionName, tasks]) => (
              <div key={positionName}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">{positionName}</h2>
                  <span className="text-sm text-[var(--color-text-secondary)]">
                    {tasks.length} task{tasks.length !== 1 ? "s" : ""}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {tasks.map((task) => (
                    <TaskCard key={`${task.id}-${refreshKey}`} task={task} onTaskUpdate={handleTaskUpdate} />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Summary Footer */}
        <div className="mt-8 p-4 bg-white rounded-lg border border-[var(--color-border)]">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[var(--color-text-secondary)]">
              Summary for {new Date(currentDate).toLocaleDateString("en-AU")}
            </span>
            <div className="flex items-center space-x-4">
              <span className="text-green-600">{taskCounts.done} Done</span>
              <span className="text-blue-600">{taskCounts.due_today} Due Today</span>
              <span className="text-orange-600">{taskCounts.overdue} Overdue</span>
              <span className="text-red-600">{taskCounts.missed} Missed</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
