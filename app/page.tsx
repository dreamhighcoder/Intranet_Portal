"use client"

import { useAuth } from "@/lib/auth"
import { Navigation } from "@/components/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { Users, Stethoscope, Package, Wrench, Shield, Building } from "lucide-react"

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
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--color-bg)" }}>
        <div className="text-center">
          <div
            className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto"
            style={{ borderColor: "var(--color-primary)" }}
          ></div>
          <p className="mt-2" style={{ color: "var(--color-text-muted)" }}>
            Loading...
          </p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null // Will redirect to login
  }

  const staffChecklists = [
    {
      title: "Checklist – Pharmacist (Primary)",
      description: "Licensed pharmacist duties and clinical responsibilities",
      icon: Stethoscope,
      href: "/checklist?position=pharmacist-primary",
      iconBg: "var(--color-primary)",
    },
    {
      title: "Checklist – Pharmacist (Supporting)",
      description: "Supporting pharmacist tasks and backup duties",
      icon: Stethoscope,
      href: "/checklist?position=pharmacist-supporting",
      iconBg: "#1565c0", // Due today blue
    },
    {
      title: "Checklist – Pharmacy Assistants",
      description: "Dispensing assistance and customer service tasks",
      icon: Users,
      href: "/checklist?position=pharmacy-assistants",
      iconBg: "var(--accent-green)",
    },
    {
      title: "Checklist – Dispensary Technicians",
      description: "Technical dispensing and preparation tasks",
      icon: Package,
      href: "/checklist?position=dispensary-technicians",
      iconBg: "#2e7d32", // Done green
    },
    {
      title: "Checklist – DAA Packers",
      description: "Dose administration aid packing and quality control",
      icon: Package,
      href: "/checklist?position=daa-packers",
      iconBg: "#fb8c00", // Overdue orange
    },
    {
      title: "Checklist – Operational/Managerial",
      description: "Management oversight and operational tasks",
      icon: Building,
      href: "/checklist?position=operational-managerial",
      iconBg: "#d12c2c", // Missed red
    },
  ]

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--color-bg)" }}>
      <Navigation />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Banner */}
        <div className="mb-8">
          <div className="pharmacy-gradient rounded-lg p-6" style={{ color: "var(--color-primary-on)" }}>
            <h1 className="text-3xl font-bold mb-2">Welcome back, {user.profile?.display_name || user.email?.split('@')[0] || 'User'}!</h1>
            <p className="opacity-90">
              {user.profile?.role === "admin" ? "Administrator" : user.profile?.display_name || "User"} • Ready to manage your tasks
            </p>
          </div>
        </div>

        {/* Staff Checklists Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-6" style={{ color: "var(--color-text)" }}>
            Staff Checklists
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {staffChecklists.map((checklist) => {
              const IconComponent = checklist.icon
              return (
                <Card key={checklist.title} className="card-surface hover:shadow-lg transition-all duration-200 group flex flex-col h-full">
                  <CardHeader className="pb-3">
                    <div className="flex items-center space-x-3">
                      <div
                        className="p-2 rounded-lg text-white group-hover:scale-110 transition-transform"
                        style={{ backgroundColor: checklist.iconBg }}
                      >
                        <IconComponent className="h-5 w-5" />
                      </div>
                      <CardTitle className="text-lg leading-tight" style={{ color: "var(--color-text)" }}>
                        {checklist.title}
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 flex-1 flex flex-col">
                    <p className="mb-4 text-sm leading-relaxed flex-1" style={{ color: "var(--color-text-muted)" }}>
                      {checklist.description}
                    </p>
                    <Button
                      asChild
                      className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 text-[var(--color-primary-on)] border-0 mt-auto"
                    >
                      <Link href={checklist.href}>Open Checklist</Link>
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>

        {/* Quick Admin Access */}
        {user.profile?.role === "admin" && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4" style={{ color: "var(--color-text)" }}>
              Administrative Tools
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="card-surface hover:shadow-md transition-shadow">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center" style={{ color: "var(--color-text)" }}>
                    <Shield className="h-5 w-5 mr-2" style={{ color: "var(--color-primary)" }} />
                    Admin Dashboard
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="mb-4" style={{ color: "var(--color-text-muted)" }}>
                    View reports, manage tasks and system settings
                  </p>
                  <Button
                    asChild
                    variant="outline"
                    className="w-full bg-transparent border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-secondary)]"
                  >
                    <Link href="/admin">Admin Panel</Link>
                  </Button>
                </CardContent>
              </Card>

              <Card className="card-surface hover:shadow-md transition-shadow">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center" style={{ color: "var(--color-text)" }}>
                    <Wrench className="h-5 w-5 mr-2" style={{ color: "var(--color-primary)" }} />
                    Master Tasks
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="mb-4" style={{ color: "var(--color-text-muted)" }}>
                    Create and manage master task templates
                  </p>
                  <Button
                    asChild
                    variant="outline"
                    className="w-full bg-transparent border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-secondary)]"
                  >
                    <Link href="/admin/master-tasks">Manage Tasks</Link>
                  </Button>
                </CardContent>
              </Card>

              <Card className="card-surface hover:shadow-md transition-shadow">
                <CardHeader>
                  <CardTitle className="text-lg" style={{ color: "var(--color-text)" }}>
                    Calendar View
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="mb-4" style={{ color: "var(--color-text-muted)" }}>
                    Navigate tasks by date and plan ahead
                  </p>
                  <Button
                    asChild
                    variant="outline"
                    className="w-full bg-transparent border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-secondary)]"
                  >
                    <Link href="/calendar">View Calendar</Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
