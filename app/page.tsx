"use client"

import { useState } from "react"
import { usePositionAuth } from "@/lib/position-auth-context"
import { Navigation } from "@/components/navigation"
import { PublicNavigation } from "@/components/public-navigation"
import { PositionLoginModal } from "@/components/position-login-modal"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, Stethoscope, Package, Building } from "lucide-react"
import { PositionAuthService } from "@/lib/position-auth"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

export default function HomePage() {
  const { user, isLoading } = usePositionAuth()
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false)
  const [modalType, setModalType] = useState<"general" | "checklist">("general")
  const [selectedChecklistPositionId, setSelectedChecklistPositionId] = useState<string>("")
  const [selectedChecklistTitle, setSelectedChecklistTitle] = useState<string>("")
  const router = useRouter()

  // Redirect authenticated users based on their role
  useEffect(() => {
    if (!isLoading && user) {
      if (user.role === 'admin') {
        router.push('/admin')
      } else {
        router.push(`/checklist?position=${user.id}`)
      }
    }
  }, [user, isLoading, router])

  // Show loading state
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

  // If user is authenticated, they'll be redirected, so show loading
  if (user) {
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

  // Get checklist positions (excluding administrator)
  const checklistPositions = PositionAuthService.getChecklistPositions()
  
  const staffChecklists = [
    {
      title: "Checklist – Pharmacist (Primary)",
      description: "Licensed pharmacist duties and clinical responsibilities",
      icon: Stethoscope,
      positionId: "550e8400-e29b-41d4-a716-446655440001",
      iconBg: "var(--color-primary)",
    },
    {
      title: "Checklist – Pharmacist (Supporting)",
      description: "Supporting pharmacist tasks and backup duties",
      icon: Stethoscope,
      positionId: "550e8400-e29b-41d4-a716-446655440002",
      iconBg: "#1565c0", // Due today blue
    },
    {
      title: "Checklist – Pharmacy Assistants",
      description: "Dispensing assistance and customer service tasks",
      icon: Users,
      positionId: "550e8400-e29b-41d4-a716-446655440003",
      iconBg: "var(--accent-green)",
    },
    {
      title: "Checklist – Dispensary Technicians",
      description: "Technical dispensing and preparation tasks",
      icon: Package,
      positionId: "550e8400-e29b-41d4-a716-446655440004",
      iconBg: "#2e7d32", // Done green
    },
    {
      title: "Checklist – DAA Packers",
      description: "Dose administration aid packing and quality control",
      icon: Package,
      positionId: "550e8400-e29b-41d4-a716-446655440005",
      iconBg: "#fb8c00", // Overdue orange
    },
    {
      title: "Checklist – Operational/Managerial",
      description: "Management oversight and operational tasks",
      icon: Building,
      positionId: "550e8400-e29b-41d4-a716-446655440006",
      iconBg: "#d12c2c", // Missed red
    },
  ]

  const handleLoginClick = () => {
    setModalType("general")
    setIsLoginModalOpen(true)
  }

  const handleChecklistClick = (checklist: typeof staffChecklists[0]) => {
    setModalType("checklist")
    setSelectedChecklistPositionId(checklist.positionId)
    setSelectedChecklistTitle(checklist.title.replace("Checklist – ", ""))
    setIsLoginModalOpen(true)
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--color-bg)" }}>
      <PublicNavigation onLoginClick={handleLoginClick} />

      <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Banner */}
        <div className="mb-8">
          <div className="pharmacy-gradient rounded-lg p-6" style={{ color: "var(--color-primary-on)" }}>
            <h1 className="text-3xl font-bold mb-2">Welcome to Richmond Pharmacy</h1>
            <p className="opacity-90">
              Access your position-specific checklist to manage daily tasks and responsibilities
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
                      onClick={() => handleChecklistClick(checklist)}
                      className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 text-[var(--color-primary-on)] border-0 mt-auto"
                    >
                      Open Checklist
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      </main>

      {/* Login Modal */}
      <PositionLoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        modalType={modalType}
        checklistPositionId={selectedChecklistPositionId}
        checklistTitle={selectedChecklistTitle}
      />
    </div>
  )
}
