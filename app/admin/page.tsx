"use client"

import { useEffect } from "react"
import { useAuth } from "@/lib/auth"
import { Navigation } from "@/components/navigation"
import { KPIWidgets } from "@/components/admin/kpi-widgets"
import { RecentMissedTasks } from "@/components/admin/recent-missed-tasks"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Users, ClipboardList, Calendar, Settings, BarChart3 } from "lucide-react"

export default function AdminDashboard() {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && (!user || user.profile?.role !== "admin")) {
      router.push("/")
    }
  }, [user, isLoading, router])

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

  if (!user || user.profile?.role !== "admin") return null

  const quickActions = [
    {
      title: "Master Tasks",
      description: "Manage checklist templates and task definitions",
      href: "/admin/master-tasks",
      icon: ClipboardList,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      title: "Users & Positions",
      description: "Manage staff positions and user accounts",
      href: "/admin/users-positions",
      icon: Users,
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
    {
      title: "Public Holidays",
      description: "Configure public holidays for task scheduling",
      href: "/admin/public-holidays",
      icon: Calendar,
      color: "text-purple-600",
      bgColor: "bg-purple-100",
    },
    {
      title: "Reports",
      description: "Generate performance and compliance reports",
      href: "/admin/reports",
      icon: BarChart3,
      color: "text-orange-600",
      bgColor: "bg-orange-100",
    },
    {
      title: "Settings",
      description: "System configuration and preferences",
      href: "/admin/settings",
      icon: Settings,
      color: "text-gray-600",
      bgColor: "bg-gray-100",
    },
  ]

  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      <Navigation />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="pharmacy-gradient rounded-lg p-6 text-white">
            <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
            <p className="text-white/90">System overview and management tools</p>
          </div>
        </div>

        {/* KPI Widgets */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-4">Performance Overview</h2>
          <KPIWidgets />
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {quickActions.map((action) => {
              const Icon = action.icon
              return (
                <Card key={action.title} className="card-surface hover:shadow-md transition-shadow h-[200px] flex flex-col">
                  <CardHeader className="pb-3">
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 rounded-lg ${action.bgColor}`}>
                        <Icon className={`w-5 h-5 ${action.color}`} />
                      </div>
                      <CardTitle className="text-lg">{action.title}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-grow flex flex-col justify-between pt-0">
                    <p className="text-[var(--color-text-secondary)] text-sm leading-relaxed">{action.description}</p>
                    <Button asChild variant="outline" className="w-full bg-transparent mt-4">
                      <Link href={action.href}>Manage</Link>
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>

        {/* Recent Issues */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <RecentMissedTasks />

          <Card className="card-surface">
            <CardHeader>
              <CardTitle>System Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <div>
                    <h4 className="font-medium text-green-800">Task Scheduler</h4>
                    <p className="text-sm text-green-600">Running normally</p>
                  </div>
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                </div>

                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <div>
                    <h4 className="font-medium text-green-800">Database</h4>
                    <p className="text-sm text-green-600">Connected</p>
                  </div>
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                </div>

                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                  <div>
                    <h4 className="font-medium text-blue-800">Last Backup</h4>
                    <p className="text-sm text-blue-600">2 hours ago</p>
                  </div>
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
