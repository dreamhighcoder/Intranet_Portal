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
import { useToast } from "@/hooks/use-toast"

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
  const { signIn } = usePositionAuth()
  const router = useRouter()
  const { toast } = useToast()

  // Get available positions based on modal type
  const getAvailablePositions = (): PositionAuth[] => {
    if (modalType === "checklist" && checklistPositionId) {
      // For checklist modal: show the specific position first, then Administrator
      const specificPosition = PositionAuthService.getAllPositions().find(p => p.id === checklistPositionId)
      const adminPosition = PositionAuthService.getAllPositions().find(p => p.id === 'administrator')
      return [specificPosition, adminPosition].filter(Boolean) as PositionAuth[]
    }
    // For general modal: show all positions with Administrator first
    const allPositions = PositionAuthService.getAllPositions()
    const admin = allPositions.find(p => p.id === 'administrator')
    const others = allPositions.filter(p => p.id !== 'administrator')
    return admin ? [admin, ...others] : allPositions
  }

  const availablePositions = getAvailablePositions()

  // Set default values when modal opens
  useEffect(() => {
    if (isOpen) {
      if (modalType === "checklist" && checklistPositionId) {
        // For checklist modal: default to the corresponding position
        setSelectedPosition(checklistPositionId)
      } else if (modalType === "general") {
        // For general modal: default to Administrator
        setSelectedPosition("administrator")
      }
    }
  }, [isOpen, modalType, checklistPositionId])

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
      toast({
        title: "Missing Information",
        description: "Please select a position and enter password",
        variant: "destructive",
      })
      setIsSubmitting(false)
      return
    }

    try {
      const { success, error: signInError } = await signIn(selectedPosition, password)

      if (success) {
        onClose()
        
        // Redirect based on authentication result
        const user = PositionAuthService.getCurrentUser()
        if (user?.role === 'admin') {
          // Admin always goes to dashboard regardless of modal type
          router.push('/admin')
        } else if (modalType === "checklist" && checklistPositionId) {
          // From checklist button, go to that specific checklist
          router.push(`/checklist?position=${checklistPositionId}`)
        } else {
          // From general login, go to their own position checklist
          router.push(`/checklist?position=${selectedPosition}`)
        }
      } else {
        toast({
          title: "Login Failed",
          description: signInError || "Invalid position or password",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Login Error",
        description: "Login failed. Please try again.",
        variant: "destructive",
      })
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
            <Select value={selectedPosition} onValueChange={setSelectedPosition} disabled={isSubmitting}>
              <SelectTrigger className="w-full bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text)]">
                <SelectValue placeholder="Select your position" />
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
            {isSubmitting ? "Signing in..." : "Login"}
          </Button>
        </form>

        {/* Demo Helper (only for development) */}
        {process.env.NODE_ENV === "development" && (
          <div className="mt-6 p-4 bg-[var(--color-tertiary)] rounded-lg">
            <p className="text-sm text-[var(--color-text)] mb-2 font-medium">Demo Passwords:</p>
            <div className="text-xs space-y-1 text-[var(--color-text-muted)]">
              <p>Administrator: admin123</p>
              <p>Pharmacist (Primary): pharmprim123</p>
              <p>Pharmacist (Supporting): pharmsup123</p>
              <p>Pharmacy Assistants: assistant123</p>
              <p>Dispensary Technicians: tech123</p>
              <p>DAA Packers: packer123</p>
              <p>Operational/Managerial: ops123</p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}