"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { authenticatedGet } from "@/lib/api-client"
import { usePositionAuth } from "@/lib/position-auth-context"

interface DashboardStats {
  newSince9am: number
  dueToday: number
  overdue: number
  missed: number
}

export function DashboardStats() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const { user, isLoading: authLoading } = usePositionAuth()

  useEffect(() => {
    async function fetchDashboardStats() {
      if (authLoading || !user || !user.isAuthenticated) {
        console.log('DashboardStats: Skipping fetch - user not authenticated:', { authLoading, hasUser: !!user, isAuthenticated: user?.isAuthenticated })
        setIsLoading(false)
        return
      }
      
      try {
        const data = await authenticatedGet('/api/dashboard')
        if (data) {
          setStats({
            newSince9am: data.summary.newSince9am || 0,
            dueToday: data.today.total || 0,
            overdue: data.summary.overdueTasks || 0,
            missed: data.summary.missedLast7Days || 0,
          })
        }
      } catch (error) {
        console.error('Error fetching dashboard stats:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchDashboardStats()
  }, [user, authLoading])

  const statCards = [
    {
      title: "New Since 9:00 AM",
      value: isLoading ? "..." : stats?.newSince9am || 0,
      description: "Tasks created today after 9:00 AM",
      color: "text-blue-600",
    },
    {
      title: "Due Today",
      value: isLoading ? "..." : stats?.dueToday || 0,
      description: "Tasks due today",
      color: "text-orange-600",
    },
    {
      title: "Overdue",
      value: isLoading ? "..." : stats?.overdue || 0,
      description: "Tasks currently overdue",
      color: "text-red-600",
    },
    {
      title: "Missed",
      value: isLoading ? "..." : stats?.missed || 0,
      description: "Tasks missed in last 7 days",
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
