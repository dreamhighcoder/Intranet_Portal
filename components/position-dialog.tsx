"use client"

import { useState, useEffect } from "react"
import { usePositionAuth } from "@/lib/position-auth-context"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Lock } from "lucide-react"
import { Position } from "@/lib/types"
import { authenticatedPost, authenticatedPut } from "@/lib/api-client"
import { PositionAuthService } from "@/lib/position-auth"
import { toastSuccess, toastError } from "@/hooks/use-toast"

interface PositionDialogProps {
  isOpen: boolean
  onClose: () => void
  position?: Position | null
  onSave: () => void
}

export function PositionDialog({ isOpen, onClose, position, onSave }: PositionDialogProps) {
  const { user, isSuperAdmin } = usePositionAuth()
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  const isEditing = Boolean(position)
  const title = isEditing ? "Edit Position" : "Add Position"

  // Check if current user can edit password for this position
  const canEditPassword = (pos: Position | null) => {
    if (!pos) return true // New positions can always have passwords set
    
    // Super admins can edit all passwords
    if (isSuperAdmin) {
      return true
    }
    
    // Regular admins cannot edit other admin passwords
    if (pos.password_hash && (
        pos.name.toLowerCase().includes('administrator') || 
        pos.name.toLowerCase().includes('admin')
      )) {
      // Check if this is their own position by comparing the password
      if (user?.position?.password && pos.password_hash) {
        const decodedPassword = atob(pos.password_hash)
        return user.position.password === decodedPassword
      }
      return false
    }
    
    // Regular admins can edit non-admin position passwords
    return true
  }

  const canEditThisPassword = canEditPassword(position)

  useEffect(() => {
    if (position) {
      setName(position.name || "")
      setDescription(position.description || "")
    } else {
      setName("")
      setDescription("")
    }
    setPassword("") // Always reset password field
    setNameError(null)
    setPasswordError(null)
  }, [position])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Reset errors
    setNameError(null)
    setPasswordError(null)

    // Client-side required validation
    const trimmedName = name.trim()
    const trimmedPassword = password.trim()

    if (!trimmedName) {
      setNameError("Position name is required")
      toastError("Validation Error", "Position name is required")
      return
    }

    if (!isEditing && canEditThisPassword && !trimmedPassword) {
      setPasswordError("Password is required")
      toastError("Validation Error", "Password is required")
      return
    }

    setIsLoading(true)

    try {
      const data = {
        name: trimmedName,
        description: description.trim(),
        ...(password && canEditThisPassword && { password: trimmedPassword })
      }

      if (isEditing && position) {
        await authenticatedPut(`/api/positions/${position.id}`, data)
        toastSuccess("Position Updated", "Position has been updated successfully")
      } else {
        await authenticatedPost('/api/positions', data)
        toastSuccess("Position Created", "Position has been created successfully")
      }

      // Clear positions cache to ensure immediate updates across the app
      PositionAuthService.clearCache()
      
      onSave()
      handleClose()
    } catch (error) {
      // Try to extract the specific error message from the API response
      let errorMessage = "Failed to save position. Please try again."
      
      if (error instanceof Error) {
        // Check if this is a validation error with a specific message
        const lowerErrorMessage = error.message.toLowerCase()
        if (lowerErrorMessage.includes("password is already in use") || 
            lowerErrorMessage.includes("password") && lowerErrorMessage.includes("already")) {
          errorMessage = "This password is already in use by another position. Please choose a different password."
          setPassword("") // Clear the password field
        } else if (lowerErrorMessage.includes("duplicate") || lowerErrorMessage.includes("already exists")) {
          errorMessage = "A position with similar details already exists. Please check the name and password."
        } else if (error.message.trim() !== "" && !error.message.startsWith("Failed to post")) {
          // Use any specific error message from the server that's not a generic fetch error
          errorMessage = error.message
        }
      }
      
      toastError("Save Failed", errorMessage)

      // Inline error rendering hints
      if (errorMessage.toLowerCase().includes("password") && errorMessage.toLowerCase().includes("already")) {
        setPasswordError("This password is already in use by another position.")
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    setName("")
    setDescription("")
    setPassword("")
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} noValidate className="space-y-6 pt-4">
          <div className="space-y-2">
            <Label htmlFor="name">Position Name *</Label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); if (nameError) setNameError(null) }}
              placeholder="Enter position name"
              className={`bg-white dark:bg-white ${nameError ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
              aria-invalid={!!nameError}
              aria-describedby={nameError ? 'name-error' : undefined}
            />
            {nameError && (
              <p id="name-error" className="text-xs text-red-600 mt-1">{nameError}</p>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter position description"
              className="bg-white dark:bg-white"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">
              {isEditing ? "New Password (optional)" : "Password *"}
            </Label>
            {canEditThisPassword ? (
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); if (passwordError) setPasswordError(null) }}
                placeholder={isEditing ? "Leave blank to keep current password" : "Enter password for this position"}
                className={`bg-white dark:bg-white ${passwordError ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                aria-invalid={!!passwordError}
                aria-describedby={passwordError ? 'password-error' : undefined}
              />
            ) : (
              <div className="flex items-center space-x-2 p-2 bg-gray-50 border rounded-md">
                <Lock className="w-4 h-4 text-gray-500" />
                <span className="text-sm text-gray-600">Password protected - cannot be changed</span>
              </div>
            )}
            {passwordError && (
              <p id="password-error" className="text-xs text-red-600 mt-1">{passwordError}</p>
            )}
            <p className="text-xs text-gray-600 mt-1">
              {canEditThisPassword ? (
                <>
                  This password will be used for position-based authentication
                  <span className="block text-amber-600 mt-1 font-medium">
                    ⚠️ Position passwords must be unique. Each position requires a different password for security.
                  </span>
                </>
              ) : (
                "Only Super Admins can change passwords for other admin positions"
              )}
            </p>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 text-[var(--color-primary-on)]"
            >
              {isLoading ? "Saving..." : isEditing ? "Update" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}