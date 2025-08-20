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
      // Wait for auth to complete loading
      if (authLoading) {
        console.log('DashboardStats: Auth still loading, waiting...')
        return
      }
      
      // Check if user is authenticated
      if (!user || !user.isAuthenticated) {
        console.log('DashboardStats: Skipping fetch - user not authenticated:', { hasUser: !!user, isAuthenticated: user?.isAuthenticated })
        setIsLoading(false)
        return
      }
      
      // Add a small delay to ensure authentication context is fully ready
      await new Promise(resolve => setTimeout(resolve, 100))
      
      try {
        console.log('DashboardStats: Fetching dashboard data for authenticated user:', user.displayName)
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
        console.error('DashboardStats: Error fetching dashboard stats:', error)
        // Set fallback stats if request fails
        setStats({
          newSince9am: 0,
          dueToday: 0,
          overdue: 0,
          missed: 0,
        })
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
