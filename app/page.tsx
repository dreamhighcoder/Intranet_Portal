"use client"

import { useAuth } from "@/lib/auth"
import { Navigation } from "@/components/navigation"
import { DashboardStats } from "@/components/dashboard-stats"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

export default function HomePage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login")
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

  if (!user) {
    return null // Will redirect to login
  }

  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      <Navigation />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Banner */}
        <div className="mb-8">
          <div className="pharmacy-gradient rounded-lg p-6 text-white">
            <h1 className="text-3xl font-bold mb-2">Welcome back, {user.display_name}!</h1>
            <p className="text-white/90">
              {user.role === "admin" ? "Administrator" : user.display_name} • Ready to manage your tasks
            </p>
          </div>
        </div>

        {/* Stats Widgets */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-4">Today's Overview</h2>
          <DashboardStats />
        </div>

        {/* Quick Links */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="card-surface hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="text-lg">View Checklist</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-[var(--color-text-secondary)] mb-4">Check today's tasks and mark them as complete</p>
                <Button asChild className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90">
                  <Link href="/checklist">Go to Checklist</Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="card-surface hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="text-lg">Calendar View</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-[var(--color-text-secondary)] mb-4">Navigate tasks by date and plan ahead</p>
                <Button asChild variant="outline" className="w-full bg-transparent">
                  <Link href="/calendar">View Calendar</Link>
                </Button>
              </CardContent>
            </Card>

            {user.role === "admin" && (
              <Card className="card-surface hover:shadow-md transition-shadow">
                <CardHeader>
                  <CardTitle className="text-lg">Admin Dashboard</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-[var(--color-text-secondary)] mb-4">Manage tasks, users, and view reports</p>
                  <Button asChild variant="outline" className="w-full bg-transparent">
                    <Link href="/admin">Admin Panel</Link>
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
