"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { usePositionAuth } from "@/lib/position-auth-context"
import { PositionAuthService, PositionAuth } from "@/lib/position-auth"
import { useRouter } from "next/navigation"
import { toastError } from "@/hooks/use-toast"
import { toKebabCase } from "@/lib/responsibility-mapper"


interface PositionLoginModalProps {
  isOpen: boolean
  onClose: () => void
  modalType: "general" | "checklist"
  checklistPositionId?: string
  checklistTitle?: string
}

export function PositionLoginModal({ 
  isOpen, 
  onClose, 
  modalType, 
  checklistPositionId,
  checklistTitle 
}: PositionLoginModalProps) {
  const [selectedPosition, setSelectedPosition] = useState("")
  const [password, setPassword] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [availablePositions, setAvailablePositions] = useState<PositionAuth[]>([])
  const [isLoadingPositions, setIsLoadingPositions] = useState(true)
  const { signIn } = usePositionAuth()
  const router = useRouter()

  // Load available positions based on modal type
  useEffect(() => {
    const loadAvailablePositions = async () => {
      setIsLoadingPositions(true)
      try {
        const allPositions = await PositionAuthService.getAllPositions()
        console.log('🔍 All positions loaded:', allPositions.map(p => ({
          id: p.id,
          name: p.name,
          displayName: p.displayName,
          role: p.role
        })))

        // Separate admin and non-admin positions
        const admins = allPositions.filter(p => 
          p.role === 'admin' || 
          p.name.toLowerCase().includes('admin') || 
          p.displayName.toLowerCase().includes('admin')
        )
        const others = allPositions.filter(p => 
          p.role !== 'admin' && 
          !p.name.toLowerCase().includes('admin') && 
          !p.displayName.toLowerCase().includes('admin')
        )

        // Create consolidated administrator entry if any admin positions exist
        const consolidatedAdmin: PositionAuth | null = admins.length > 0 ? {
          id: 'administrator-consolidated',
          name: 'administrator',
          displayName: 'Administrator',
          password: '', // Not used - authentication will check all admin positions
          role: 'admin'
        } : null

        if (modalType === "checklist" && checklistPositionId) {
          // For checklist modal: show the specific position first, then consolidated admin
          const specificPosition = allPositions.find(p => p.id === checklistPositionId)
          
          if (specificPosition) {
            const positions = [specificPosition]
            // Only add consolidated admin if it's not the same as the specific position
            const isSpecificPositionAdmin = admins.some(admin => admin.id === specificPosition.id)
            if (consolidatedAdmin && !isSpecificPositionAdmin) {
              positions.push(consolidatedAdmin)
            }
            setAvailablePositions(positions)
          } else {
            // Fallback to consolidated administrator only
            setAvailablePositions(consolidatedAdmin ? [consolidatedAdmin] : [])
          }
        } else {
          // For general modal: show consolidated administrator first, then all other positions
          const positions = []
          if (consolidatedAdmin) {
            positions.push(consolidatedAdmin)
          }
          positions.push(...others)
          
          setAvailablePositions(positions)
        }
      } catch (error) {
        console.error('Error loading positions:', error)
        // Fallback to empty array - user will see no positions available
        setAvailablePositions([])
      } finally {
        setIsLoadingPositions(false)
      }
    }

    if (isOpen) {
      loadAvailablePositions()
    }
  }, [isOpen, modalType, checklistPositionId])

  // Set default values when modal opens
  useEffect(() => {
    if (isOpen && availablePositions.length > 0) {
      if (modalType === "checklist" && checklistPositionId) {
        // For checklist modal: default to the corresponding position
        setSelectedPosition(checklistPositionId)
      } else if (modalType === "general") {
        // For general modal: default to consolidated administrator or first available
        const consolidatedAdmin = availablePositions.find(p => p.id === 'administrator-consolidated')
        setSelectedPosition(consolidatedAdmin?.id || availablePositions[0]?.id || "")
      }
    }
  }, [isOpen, modalType, checklistPositionId, availablePositions])

  // Get modal title
  const getModalTitle = (): string => {
    if (modalType === "checklist" && checklistTitle) {
      return `${checklistTitle} Checklist`
    }
    return "Richmond Pharmacy"
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    if (!selectedPosition || !password) {
      toastError("Missing Information", "Please select a position and enter password")
      setIsSubmitting(false)
      return
    }

    try {
      const { success, error: signInError } = await signIn(selectedPosition, password)

      if (success) {
        onClose()
        
        // Redirect based on authentication result
        const user = await PositionAuthService.getCurrentUser()
        if (user?.role === 'admin') {
          router.push('/admin')
        } else if (modalType === "checklist" && checklistTitle) {
          // From checklist button, go to that role checklist page
          const role = toKebabCase(checklistTitle)
          router.push(`/checklist/${role}`)
        } else {
          // From general login, derive role from user's display name
          const role = user?.displayName ? toKebabCase(user.displayName) : ''
          if (role) {
            router.push(`/checklist/${role}`)
          } else {
            // Fallback: go to role selection page
            router.push('/')
          }
        }
      } else {
        toastError("Login Failed", signInError || "Invalid position or password")
      }
    } catch (error) {
      toastError("Login Error", "Login failed. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    setSelectedPosition("")
    setPassword("")
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="w-full max-w-xs bg-[var(--color-surface)] border-[var(--color-border)]">
        <DialogHeader className="text-center space-y-4">
          {/* Logo */}
          <div className="mx-auto w-16 h-16 bg-[var(--color-primary)] rounded-lg flex items-center justify-center">
            <svg
              className="w-8 h-8 text-[var(--color-primary-on)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 9.172V5L8 4z"
              />
            </svg>
          </div>
          <DialogTitle className="text-2xl font-semibold text-[var(--color-text)] text-center">
            {getModalTitle()}
          </DialogTitle>
          {modalType === "general" && (
            <DialogDescription className="text-[var(--color-text-muted)] text-center">
              Login to access your pharmacy portal
            </DialogDescription>
          )}
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Position Selection */}
          <div className="space-y-2">
            <Label htmlFor="position" className="text-[var(--color-text)]">
              Position
            </Label>
            <Select value={selectedPosition} onValueChange={setSelectedPosition} disabled={isSubmitting || isLoadingPositions}>
              <SelectTrigger className="w-full bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text)]">
                <SelectValue placeholder={isLoadingPositions ? "Loading positions..." : "Select your position"} />
              </SelectTrigger>
              <SelectContent>
                {availablePositions.map((position) => (
                  <SelectItem key={position.id} value={position.id}>
                    {position.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Password */}
          <div className="space-y-2">
            <Label htmlFor="password" className="text-[var(--color-text)]">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isSubmitting}
              className="w-full bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text)]"
            />
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 text-[var(--color-primary-on)] border-0"
            disabled={isSubmitting}
          >
            {isSubmitting ? "logging in..." : "Login"}
          </Button>
        </form>

        {/* Demo Helper (only for development) */}
        {process.env.NODE_ENV === "development" && (
          <div className="mt-6 p-4 bg-[var(--color-tertiary)] rounded-lg">
            <p className="text-sm text-[var(--color-text)] mb-2 font-medium">Demo Passwords:</p>
            <div className="text-xs space-y-1 text-[var(--color-text-muted)]">
              <p>Administrator: admin123</p>
              {availablePositions
                .filter(pos => pos.role !== 'admin' && !pos.displayName.toLowerCase().includes('admin'))
                .map(pos => (
                  <p key={pos.id}>{pos.displayName}: {pos.displayName.toLowerCase().replace(/[^a-z0-9]/g, '')}</p>
                ))
              }
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}