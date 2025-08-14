"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, Clock, AlertTriangle, Calendar } from "lucide-react"
import { authenticatedGet } from "@/lib/api-client"
import { useAuth } from "@/lib/auth"

interface DashboardStats {
  onTimeCompletionRate: number
  avgTimeToCompleteHours: number
  missedLast7Days: number
  totalTasks: number
}

export function KPIWidgets() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const { user, isLoading: authLoading } = useAuth()

  useEffect(() => {
    async function fetchDashboardStats() {
      if (authLoading || !user) {
        setIsLoading(false)
        return
      }
      
      try {
        const data = await authenticatedGet('/api/dashboard')
        if (data) {
          setStats({
            onTimeCompletionRate: data.summary?.onTimeCompletionRate || 0,
            avgTimeToCompleteHours: data.summary?.avgTimeToCompleteHours || 0,
            missedLast7Days: data.summary?.missedLast7Days || 0,
            totalTasks: data.summary?.totalTasks || 0,
          })
        }
      } catch (error) {
        console.error('Error fetching dashboard stats:', error)
        // Set fallback stats if request fails completely
        setStats({
          onTimeCompletionRate: 0,
          avgTimeToCompleteHours: 0,
          missedLast7Days: 0,
          totalTasks: 0,
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchDashboardStats()
  }, [user, authLoading])

  const widgets = [
    {
      title: "On-Time Completion Rate",
      value: isLoading ? "..." : `${stats?.onTimeCompletionRate || 0}%`,
      description: "Tasks completed on time",
      icon: TrendingUp,
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
    {
      title: "Average Time to Complete",
      value: isLoading ? "..." : `${stats?.avgTimeToCompleteHours || 0}h`,
      description: "Average completion time",
      icon: Clock,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      title: "Missed Tasks (7 days)",
      value: isLoading ? "..." : stats?.missedLast7Days || 0,
      description: "Tasks missed in last 7 days",
      icon: AlertTriangle,
      color: "text-red-600",
      bgColor: "bg-red-100",
    },
    {
      title: "Total Tasks",
      value: isLoading ? "..." : stats?.totalTasks || 0,
      description: "Total tasks in period",
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
