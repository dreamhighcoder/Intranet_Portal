"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { mockDashboardStats } from "@/lib/mock-data"
import { TrendingUp, Clock, AlertTriangle, Calendar } from "lucide-react"

export function KPIWidgets() {
  const stats = mockDashboardStats

  const widgets = [
    {
      title: "On-Time Completion Rate",
      value: `${stats.on_time_completion_rate}%`,
      description: "Tasks completed on time",
      icon: TrendingUp,
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
    {
      title: "Average Time to Complete",
      value: stats.avg_time_to_complete,
      description: "Average completion time",
      icon: Clock,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      title: "Missed Tasks (7 days)",
      value: stats.missed_last_7_days,
      description: "Tasks missed in last 7 days",
      icon: AlertTriangle,
      color: "text-red-600",
      bgColor: "bg-red-100",
    },
    {
      title: "Tasks Created This Month",
      value: stats.tasks_created_this_month,
      description: "New tasks this month",
      icon: Calendar,
      color: "text-purple-600",
      bgColor: "bg-purple-100",
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {widgets.map((widget) => {
        const Icon = widget.icon
        return (
          <Card key={widget.title} className="card-surface">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-[var(--color-text-secondary)]">{widget.title}</CardTitle>
              <div className={`p-2 rounded-lg ${widget.bgColor}`}>
                <Icon className={`w-4 h-4 ${widget.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${widget.color}`}>{widget.value}</div>
              <p className="text-xs text-[var(--color-text-secondary)] mt-1">{widget.description}</p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
