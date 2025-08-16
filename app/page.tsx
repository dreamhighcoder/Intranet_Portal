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

  // State for dynamic checklist positions
  const [staffChecklists, setStaffChecklists] = useState<Array<{
    title: string
    description: string
    icon: any
    positionId: string
    iconBg: string
  }>>([])
  
  // Helper function to get position descriptions
  const getPositionDescription = (displayName: string): string => {
    const descriptions: Record<string, string> = {
      "Pharmacist (Primary)": "Licensed pharmacist duties and clinical responsibilities",
      "Pharmacist (Supporting)": "Supporting pharmacist tasks and backup duties", 
      "Pharmacy Assistants": "Dispensing assistance and customer service tasks",
      "Dispensary Technicians": "Technical dispensing and preparation tasks",
      "DAA Packers": "Dose administration aid packing and quality control",
      "Operational/Managerial": "Management oversight and operational tasks"
    }
    
    return descriptions[displayName] || `${displayName} tasks and responsibilities`
  }

  // Load positions from database
  useEffect(() => {
    const loadPositions = async () => {
      try {
        const positions = await PositionAuthService.getChecklistPositions()
        const iconMap = [Stethoscope, Users, Package, Building]
        const colorMap = ["var(--color-primary)", "#1565c0", "var(--accent-green)", "#2e7d32", "#fb8c00", "#d12c2c"]
        
        const checklists = positions.map((position, index) => ({
          title: `Checklist – ${position.displayName}`,
          description: getPositionDescription(position.displayName),
          icon: iconMap[index % iconMap.length],
          positionId: position.id,
          iconBg: colorMap[index % colorMap.length]
        }))
        
        setStaffChecklists(checklists)
      } catch (error) {
        console.error('Error loading positions:', error)
        // Fallback to hardcoded positions if database fails
        const fallbackPositions = PositionAuthService.getChecklistPositionsFallback()
        const iconMap = [Stethoscope, Users, Package, Building]
        const colorMap = ["var(--color-primary)", "#1565c0", "var(--accent-green)", "#2e7d32", "#fb8c00", "#d12c2c"]
        
        const checklists = fallbackPositions.map((position, index) => ({
          title: `Checklist – ${position.displayName}`,
          description: getPositionDescription(position.displayName),
          icon: iconMap[index % iconMap.length],
          positionId: position.id,
          iconBg: colorMap[index % colorMap.length]
        }))
        
        setStaffChecklists(checklists)
      }
    }

    // refresh when positions updated anywhere (create/update/delete)
    const onPositionsUpdated = () => {
      if (!isLoading && !user) {
        loadPositions()
      }
    }
    window.addEventListener('positions-updated', onPositionsUpdated)
    
    if (!isLoading && !user) {
      loadPositions()
    }

    return () => {
      window.removeEventListener('positions-updated', onPositionsUpdated)
    }
  }, [isLoading, user])

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
