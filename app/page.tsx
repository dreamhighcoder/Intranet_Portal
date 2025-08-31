"use client"

import { useState } from "react"
import { usePositionAuth } from "@/lib/position-auth-context"
import { Navigation } from "@/components/navigation"
import { PublicNavigation } from "@/components/public-navigation"
import { PositionLoginModal } from "@/components/position-login-modal"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import ChecklistCard from "@/components/ui/ChecklistCard"
import { Users, Stethoscope, Package, Building } from "lucide-react"
import { PositionAuthService } from "@/lib/position-auth"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { toKebabCase } from "@/lib/responsibility-mapper"
import { positionsApi } from "@/lib/api-client"

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
        // Redirect to role-based checklist route
        const role = toKebabCase(user.displayName || user.position?.displayName || user.position?.name || 'user')
        router.push(`/checklist/${role}`)
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
    responsibility: string
  }>>([])

  // Helper function to get position descriptions
  const getPositionDescription = (displayName: string): string => {
    // Generate generic description based on position name
    // This removes hardcoded position names and works with any position from database
    return `${displayName} tasks and responsibilities`
  }

  // Map position names to responsibility values using our utility
  const getResponsibilityValue = (displayName: string): string => {
    return toKebabCase(displayName)
  }

  // Load positions from database - always show all positions
  useEffect(() => {
    const loadPositions = async () => {
      try {
        // Fetch all positions from API (public GET). We do NOT filter by password here so new positions appear.
        const positions = await positionsApi.getAll()
        const nonAdmin = (positions || [])
          .filter((p: any) => !p.name?.toLowerCase().includes('administrator') && !p.name?.toLowerCase().includes('admin'))
        const iconMap = [Stethoscope, Users, Package, Building]
        const colorMap = ["var(--color-primary)", "#1565c0", "var(--accent-green)", "#2e7d32", "#fb8c00", "#d12c2c"]

        // Order strictly by display_order ascending; fallback to name when equal or missing
        const positionsOrdered = nonAdmin
          .slice()
          .sort((a: any, b: any) => {
            const ao = a.display_order ?? Number.MAX_SAFE_INTEGER
            const bo = b.display_order ?? Number.MAX_SAFE_INTEGER
            if (ao !== bo) return ao - bo
            return (a.displayName || a.name).localeCompare(b.displayName || b.name)
          })

        const checklists = positionsOrdered.map((position: any, index: number) => {
          const display = position.displayName || position.name
          return ({
            title: `Checklist – ${display}`,
            description: getPositionDescription(display),
            icon: iconMap[index % iconMap.length],
            positionId: position.id,
            iconBg: colorMap[index % colorMap.length],
            responsibility: getResponsibilityValue(display)
          })
        })

        setStaffChecklists(checklists)
      } catch (error) {
        console.error('Error loading positions:', error)
        setStaffChecklists([])
      }
    }

    // refresh when positions updated anywhere (create/update/delete)
    const onPositionsUpdated = () => {
      if (!isLoading && !user) {
        loadPositions()
      }
    }

    // Listen for the custom event from ChecklistCard
    const handleOpenChecklistLogin = (event: CustomEvent<{ positionId: string; roleDisplayName: string }>) => {
      const { positionId, roleDisplayName } = event.detail;
      setModalType("checklist");
      setSelectedChecklistPositionId(positionId);
      setSelectedChecklistTitle(roleDisplayName);
      setIsLoginModalOpen(true);
    };

    window.addEventListener('positions-updated', onPositionsUpdated);
    window.addEventListener('open-checklist-login', handleOpenChecklistLogin);

    if (!isLoading && !user) {
      loadPositions()
    }

    return () => {
      window.removeEventListener('positions-updated', onPositionsUpdated);
      window.removeEventListener('open-checklist-login', handleOpenChecklistLogin);
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

  // This function is no longer used since we're using the custom event approach
  // Keeping it for reference or future use
  const handleChecklistClick = (checklist: typeof staffChecklists[0]) => {
    setModalType("checklist")
    setSelectedChecklistPositionId(checklist.positionId)
    setSelectedChecklistTitle(checklist.title.replace("Checklist – ", ""))
    setIsLoginModalOpen(true)
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--color-bg)", backgroundImage: 'url("/pharmacy-hero.jpg")', backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat" }}>
      <PublicNavigation onLoginClick={handleLoginClick} />

      <main className="max-w-content-lg mx-auto px-4 sm:px-6 lg:px-18 py-6 sm:py-8">
        {/* Welcome Banner */}
        <div className="mb-8">
          <div
            className="pharmacy-gradient rounded-lg p-4 sm:p-6 relative overflow-hidden"
            style={{
              color: "var(--color-primary-on)",
            }}
          >
            {/* Right-side hero image with smooth left-edge fade */}
            <div
              aria-hidden={true}
              className="absolute inset-y-0 right-0 w-1/3 sm:w-1/4 md:w-1/5 pointer-events-none h-full flex items-center justify-end"
            >
              <img
                src="/pharmacist.jpg"
                alt=""
                className="h-full w-auto"
                style={{
                  // Softer diagonal fade + wider horizontal assist
                  WebkitMaskImage: "linear-gradient(to top left, rgba(0,0,0,1) 52%, rgba(0,0,0,0.5) 72%, rgba(0,0,0,0) 96%), linear-gradient(to left, rgba(0,0,0,1) 50%, rgba(0,0,0,0) 92%)",
                  maskImage: "linear-gradient(to top left, rgba(0,0,0,1) 52%, rgba(0,0,0,0.5) 72%, rgba(0,0,0,0) 96%), linear-gradient(to left, rgba(0,0,0,1) 50%, rgba(0,0,0,0) 92%)",
                }}
              />
              {/* Blurring overlay near left edge for smoother blend */}
              <div
                aria-hidden={true}
                className="absolute inset-y-0 left-0 w-[55%] pointer-events-none"
                style={{
                  // backdropFilter: "blur(10px)",
                  WebkitBackdropFilter: "blur(10px)",
                  WebkitMaskImage: "linear-gradient(to right, rgba(0,0,0,1) 0%, rgba(0,0,0,0.75) 50%, rgba(0,0,0,0) 100%), radial-gradient(120% 120% at 0% 50%, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0) 60%)",
                  maskImage: "linear-gradient(to right, rgba(0,0,0,1) 0%, rgba(0,0,0,0.75) 50%, rgba(0,0,0,0) 100%), radial-gradient(120% 120% at 0% 50%, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0) 60%)",
                }}
              />
            </div>

            {/* Content */}
            <div className="relative z-10">
              <h1 className="text-2xl sm:text-3xl font-bold mb-2">Welcome to Richmond Pharmacy</h1>
              <p className="opacity-90 text-sm sm:text-base">
                Access your position-specific checklist to manage daily tasks and responsibilities
              </p>
            </div>
          </div>
        </div>

        {/* Staff Checklists Section */}
        <div className="mb-8">
          <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6" style={{ color: "white" }}>
            Staff Checklists
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {staffChecklists.map((checklist) => {
              const IconComponent = checklist.icon
              // Ensure non-empty role; fall back to slug from title; if still empty, skip rendering the card
              const derivedRole = (checklist.responsibility || '').trim() || toKebabCase(checklist.title.replace('Checklist – ', ''))
              if (!derivedRole) {
                console.warn('Skipping ChecklistCard due to empty role', { checklist })
                return null
              }
              return (
                <ChecklistCard
                  key={checklist.title}
                  role={derivedRole}
                  roleDisplayName={checklist.title.replace("Checklist – ", "")}
                  positionId={checklist.positionId}
                  icon={IconComponent}
                  iconBg={checklist.iconBg}
                />
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
