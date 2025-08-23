"use client"

import { useEffect, useState } from "react"
import { usePositionAuth } from "@/lib/position-auth-context"
import { Navigation } from "@/components/navigation"
import { KPIWidgets } from "@/components/admin/kpi-widgets"
import { RecentMissedTasks } from "@/components/admin/recent-missed-tasks"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Users, ClipboardList, Calendar, Settings, BarChart3 } from "lucide-react"
import { authenticatedGet } from "@/lib/api-client"

export default function AdminDashboard() {
  const { user, isLoading, isAdmin } = usePositionAuth()
  const router = useRouter()

  const [diagnostics, setDiagnostics] = useState<{
    masterTasks: number
    taskInstances: number
    positions: number
  } | null>(null)

  useEffect(() => {
    if (!isLoading && (!user || !isAdmin)) {
      router.push("/")
    }
  }, [user, isAdmin, isLoading, router])

  useEffect(() => {
    if (!isLoading && user && isAdmin) {
      loadDiagnostics()
    }
  }, [user, isAdmin, isLoading])

  const loadDiagnostics = async () => {
    if (!user || !user.isAuthenticated || user.role !== 'admin') {
      console.log('AdminDashboard: Skipping diagnostics - user not authenticated or not admin')
      return
    }
    
    try {
      console.log('AdminDashboard: Loading diagnostics...')
      const [masterTasksData, taskInstancesData, positionsData] = await Promise.all([
        authenticatedGet('/api/master-tasks?status=all'),
        authenticatedGet('/api/task-instances'),
        authenticatedGet('/api/positions')
      ])

      console.log('AdminDashboard: Diagnostics loaded:', {
        masterTasksData: masterTasksData?.length || 0,
        taskInstancesData: taskInstancesData?.length || 0, 
        positionsData: positionsData?.length || 0
      })

      setDiagnostics({
        masterTasks: masterTasksData?.length || 0,
        taskInstances: taskInstancesData?.length || 0,
        positions: positionsData?.length || 0
      })
    } catch (error) {
      console.error('AdminDashboard: Error loading diagnostics:', error)
    }
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



  if (!user || !isAdmin) return null

  const quickActions = [
    {
      title: "Master Tasks",
      description: "Manage checklist templates and task definitions",
      icon: ClipboardList,
      href: "/admin/master-tasks",
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      title: "Position Checklists",
      description: "View daily checklists and task status for all positions",
      icon: ClipboardList,
      href: "/checklist",
      color: "text-teal-600",
      bgColor: "bg-teal-100",
    },
    {
      title: "Reports",
      description: "View performance analytics and completion reports",
      icon: BarChart3,
      href: "/admin/reports",
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
    {
      title: "User Management",
      description: "Manage user positions and access permissions",
      icon: Users,
      href: "/admin/users-positions",
      color: "text-purple-600",
      bgColor: "bg-purple-100",
    },
    {
      title: "Calendar",
      description: "View and manage scheduled tasks across all positions",
      icon: Calendar,
      href: "/calendar",
      color: "text-orange-600",
      bgColor: "bg-orange-100",
    },
    {
      title: "Public Holidays",
      description: "Configure public holidays and special dates",
      icon: Calendar,
      href: "/admin/public-holidays",
      color: "text-indigo-600",
      bgColor: "bg-indigo-100",
    },
    {
      title: "Settings",
      description: "System configuration and preferences",
      icon: Settings,
      href: "/admin/settings",
      color: "text-gray-600",
      bgColor: "bg-gray-100",
    },
  ]

  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      <Navigation />

      <main className="max-w-content-lg mx-auto px-4 sm:px-6 lg:px-18 py-6 sm:py-8">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="pharmacy-gradient rounded-lg p-4 sm:p-6 text-white">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold mb-2">Admin Dashboard</h1>
                <p className="text-white/90 text-sm sm:text-base">
                  Monitor task completion and manage pharmacy operations
                </p>
                {diagnostics && (
                  <div className="text-xs sm:text-sm text-white/80 mt-2">
                    Database: {diagnostics.masterTasks} master tasks • {diagnostics.taskInstances} task instances • {diagnostics.positions} positions
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* KPI Widgets */}
        <div className="mb-6 sm:mb-8">
          <KPIWidgets />
        </div>

        {/* Quick Actions Grid */}
        <div className="mb-6 sm:mb-8">
          <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-[var(--color-text)]">Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {quickActions.map((action) => {
              const IconComponent = action.icon
              return (
                <Card key={action.title} className="card-surface hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-2 sm:pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base sm:text-lg text-[var(--color-text)]">
                        {action.title}
                      </CardTitle>
                      <div className={`p-2 rounded-lg ${action.bgColor}`}>
                        <IconComponent className={`w-4 h-4 sm:w-5 sm:h-5 ${action.color}`} />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] mb-3 sm:mb-4">
                      {action.description}
                    </p>
                    <Button 
                      asChild
                      className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 text-[var(--color-primary-on)] text-sm"
                    >
                      <Link href={action.href}>
                        Manage
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>

        {/* Recent Missed Tasks */}
        <div>
          <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-[var(--color-text)]">Recent Issues</h2>
          <RecentMissedTasks />
        </div>
      </main>
    </div>
  )
}