"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/lib/auth"
import { Navigation } from "@/components/navigation"
import { ReportFilters } from "@/components/admin/report-filters"
import { ReportCharts } from "@/components/admin/report-charts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { mockTaskInstances, mockMasterTasks, mockPositions } from "@/lib/mock-data"
import { useRouter } from "next/navigation"

export default function ReportsPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const [filteredTasks, setFilteredTasks] = useState(mockTaskInstances)

  useEffect(() => {
    if (!isLoading && (!user || user.role !== "admin")) {
      router.push("/")
    }
  }, [user, isLoading, router])

  const handleFiltersChange = (filters: any) => {
    // Mock filtering logic - in real app, this would query the database
    console.log("Applying filters:", filters)
    // For demo, just show all tasks
    setFilteredTasks(mockTaskInstances)
  }

  const handleExport = (format: "csv" | "excel") => {
    // Mock export functionality
    console.log(`Exporting report as ${format}`)

    // Create mock CSV data
    const csvData = filteredTasks.map((task) => {
      const masterTask = mockMasterTasks.find((mt) => mt.id === task.master_task_id)
      const position = mockPositions.find((p) => p.id === task.position_id)

      return {
        "Task Title": masterTask?.title || "Unknown",
        Position: position?.name || "Unknown",
        Category: masterTask?.category || "Unknown",
        "Due Date": task.due_date,
        "Due Time": task.due_time,
        Status: task.status,
        "Completed At": task.completed_at || "Not completed",
        "Completed By": task.completed_by || "N/A",
      }
    })

    // Convert to CSV string
    const headers = Object.keys(csvData[0] || {})
    const csvContent = [
      headers.join(","),
      ...csvData.map((row) => headers.map((header) => `"${row[header as keyof typeof row]}"`).join(",")),
    ].join("\n")

    // Download file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `pharmacy-tasks-report.${format === "excel" ? "csv" : "csv"}`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
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

  const tasksWithDetails = filteredTasks.map((task) => ({
    ...task,
    master_task: mockMasterTasks.find((mt) => mt.id === task.master_task_id)!,
    position: mockPositions.find((p) => p.id === task.position_id)!,
  }))

  const getStatusColor = (status: string) => {
    switch (status) {
      case "done":
        return "bg-green-100 text-green-800 border-green-200"
      case "missed":
        return "bg-red-100 text-red-800 border-red-200"
      case "overdue":
        return "bg-orange-100 text-orange-800 border-orange-200"
      case "due_today":
        return "bg-blue-100 text-blue-800 border-blue-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      <Navigation />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-2">Reports</h1>
          <p className="text-[var(--color-text-secondary)]">
            Generate performance and compliance reports with detailed analytics
          </p>
        </div>

        {/* Filters */}
        <div className="mb-8">
          <ReportFilters onFiltersChange={handleFiltersChange} onExport={handleExport} />
        </div>

        {/* Charts */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-4">Analytics</h2>
          <ReportCharts />
        </div>

        {/* Task Details Table */}
        <Card className="card-surface">
          <CardHeader>
            <CardTitle>Task Details ({tasksWithDetails.length} tasks)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Task Title</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Completed At</TableHead>
                    <TableHead>Completed By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasksWithDetails.map((task) => (
                    <TableRow key={task.id}>
                      <TableCell>
                        <div className="font-medium">{task.master_task.title}</div>
                      </TableCell>
                      <TableCell>{task.position.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{task.master_task.category}</Badge>
                      </TableCell>
                      <TableCell>
                        {task.due_date} at {task.due_time}
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(task.status)}>{task.status.replace("_", " ")}</Badge>
                      </TableCell>
                      <TableCell>
                        {task.completed_at ? new Date(task.completed_at).toLocaleString("en-AU") : "Not completed"}
                      </TableCell>
                      <TableCell>{task.completed_by || "N/A"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
