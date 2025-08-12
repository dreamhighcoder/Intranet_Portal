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

  const staffChecklists = [
    {
      title: "Checklist – Pharmacist (Primary)",
      description: "Licensed pharmacist duties and clinical responsibilities",
      icon: Stethoscope,
      href: "/checklist?position=pharmacist-primary",
      color: "bg-blue-500",
    },
    {
      title: "Checklist – Pharmacist (Supporting)",
      description: "Supporting pharmacist tasks and backup duties",
      icon: Stethoscope,
      href: "/checklist?position=pharmacist-supporting",
      color: "bg-blue-400",
    },
    {
      title: "Checklist – Pharmacy Assistants",
      description: "Dispensing assistance and customer service tasks",
      icon: Users,
      href: "/checklist?position=pharmacy-assistants",
      color: "bg-green-500",
    },
    {
      title: "Checklist – Dispensary Technicians",
      description: "Technical dispensing and preparation tasks",
      icon: Package,
      href: "/checklist?position=dispensary-technicians",
      color: "bg-purple-500",
    },
    {
      title: "Checklist – DAA Packers",
      description: "Dose administration aid packing and quality control",
      icon: Package,
      href: "/checklist?position=daa-packers",
      color: "bg-orange-500",
    },
    {
      title: "Checklist – Operational/Managerial",
      description: "Management oversight and operational tasks",
      icon: Building,
      href: "/checklist?position=operational-managerial",
      color: "bg-teal-500",
    },
  ]

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

        {/* Staff Checklists Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-6">Staff Checklists</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {staffChecklists.map((checklist) => {
              const IconComponent = checklist.icon
              return (
                <Card key={checklist.title} className="card-surface hover:shadow-lg transition-all duration-200 group">
                  <CardHeader className="pb-3">
                    <div className="flex items-center space-x-3">
                      <div
                        className={`p-2 rounded-lg ${checklist.color} text-white group-hover:scale-110 transition-transform`}
                      >
                        <IconComponent className="h-5 w-5" />
                      </div>
                      <CardTitle className="text-lg leading-tight">{checklist.title}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-[var(--color-text-secondary)] mb-4 text-sm leading-relaxed">
                      {checklist.description}
                    </p>
                    <Button asChild className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90">
                      <Link href={checklist.href}>Open Checklist</Link>
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>

        {/* Quick Admin Access */}
        {user.role === "admin" && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-4">Administrative Tools</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="card-surface hover:shadow-md transition-shadow">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center">
                    <Shield className="h-5 w-5 mr-2 text-[var(--color-primary)]" />
                    Admin Dashboard
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-[var(--color-text-secondary)] mb-4">
                    View reports, manage tasks and system settings
                  </p>
                  <Button asChild variant="outline" className="w-full bg-transparent">
                    <Link href="/admin">Admin Panel</Link>
                  </Button>
                </CardContent>
              </Card>

              <Card className="card-surface hover:shadow-md transition-shadow">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center">
                    <Wrench className="h-5 w-5 mr-2 text-[var(--color-primary)]" />
                    Master Tasks
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-[var(--color-text-secondary)] mb-4">Create and manage master task templates</p>
                  <Button asChild variant="outline" className="w-full bg-transparent">
                    <Link href="/admin/master-tasks">Manage Tasks</Link>
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
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
