"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { mockDashboardStats } from "@/lib/mock-data"

export function DashboardStats() {
  const stats = mockDashboardStats

  const statCards = [
    {
      title: "New Since 9:00 AM",
      value: stats.new_since_9am,
      description: "Tasks created today after 9:00 AM",
      color: "text-blue-600",
    },
    {
      title: "Due Today",
      value: stats.due_today,
      description: "Tasks due today",
      color: "text-orange-600",
    },
    {
      title: "Overdue",
      value: stats.overdue,
      description: "Tasks currently overdue",
      color: "text-red-600",
    },
    {
      title: "Missed",
      value: stats.missed,
      description: "Tasks missed today",
      color: "text-red-800",
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {statCards.map((stat) => (
        <Card key={stat.title} className="card-surface">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-[var(--color-text-secondary)]">{stat.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
            <p className="text-xs text-[var(--color-text-secondary)] mt-1">{stat.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
