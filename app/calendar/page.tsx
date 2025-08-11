"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/lib/auth"
import { Navigation } from "@/components/navigation"
import { TaskCard } from "@/components/task-card"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getTasksForDate, getTaskCounts, formatDate } from "@/lib/task-utils"
import { useRouter } from "next/navigation"

export default function CalendarPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login")
    }
  }, [user, isLoading, router])

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

  const selectedDateString = selectedDate.toISOString().split("T")[0]
  const tasksForSelectedDate = getTasksForDate(selectedDateString)
  const taskCounts = getTaskCounts(selectedDateString)

  // Generate task counts for calendar dates (mock data for demo)
  const getTaskCountForDate = (date: Date): number => {
    const dateString = date.toISOString().split("T")[0]
    const tasks = getTasksForDate(dateString)
    return tasks.length
  }

  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      <Navigation />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-2">Calendar</h1>
          <p className="text-[var(--color-text-secondary)]">Navigate by date to view scheduled tasks and plan ahead</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Calendar */}
          <div className="lg:col-span-1">
            <Card className="card-surface">
              <CardHeader>
                <CardTitle>Task Calendar</CardTitle>
              </CardHeader>
              <CardContent>
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  className="rounded-md border-0"
                  modifiers={{
                    hasTask: (date) => getTaskCountForDate(date) > 0,
                  }}
                  modifiersStyles={{
                    hasTask: {
                      backgroundColor: "var(--color-secondary)",
                      color: "white",
                      fontWeight: "bold",
                    },
                  }}
                />
                <div className="mt-4 text-xs text-[var(--color-text-secondary)]">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-[var(--color-secondary)] rounded"></div>
                    <span>Days with tasks</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Selected Date Tasks */}
          <div className="lg:col-span-2">
            <Card className="card-surface">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Tasks for {formatDate(selectedDateString)}</CardTitle>
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline">{taskCounts.total} total</Badge>
                    {taskCounts.done > 0 && (
                      <Badge className="bg-green-100 text-green-800 border-green-200">{taskCounts.done} done</Badge>
                    )}
                    {taskCounts.overdue + taskCounts.missed > 0 && (
                      <Badge className="bg-red-100 text-red-800 border-red-200">
                        {taskCounts.overdue + taskCounts.missed} need attention
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {tasksForSelectedDate.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-[var(--color-text-secondary)]">No tasks scheduled for this date.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {tasksForSelectedDate.map((task) => (
                      <TaskCard key={`${task.id}-${refreshKey}`} task={task} onTaskUpdate={handleTaskUpdate} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="card-surface">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-blue-600">{taskCounts.due_today}</div>
                  <div className="text-xs text-[var(--color-text-secondary)]">Due Today</div>
                </CardContent>
              </Card>
              <Card className="card-surface">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-green-600">{taskCounts.done}</div>
                  <div className="text-xs text-[var(--color-text-secondary)]">Completed</div>
                </CardContent>
              </Card>
              <Card className="card-surface">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-orange-600">{taskCounts.overdue}</div>
                  <div className="text-xs text-[var(--color-text-secondary)]">Overdue</div>
                </CardContent>
              </Card>
              <Card className="card-surface">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-red-600">{taskCounts.missed}</div>
                  <div className="text-xs text-[var(--color-text-secondary)]">Missed</div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
