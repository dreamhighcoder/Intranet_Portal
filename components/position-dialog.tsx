"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const isEditing = Boolean(position)
  const title = isEditing ? "Edit Position" : "Add Position"

  useEffect(() => {
    if (position) {
      setName(position.name || "")
      setDescription(position.description || "")
    } else {
      setName("")
      setDescription("")
    }
    setPassword("") // Always reset password field
  }, [position])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!name.trim()) {
      toastError("Validation Error", "Position name is required")
      return
    }

    setIsLoading(true)

    try {
      const data = {
        name: name.trim(),
        description: description.trim(),
        ...(password && { password })
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
        <form onSubmit={handleSubmit} className="space-y-6 pt-4">
          <div className="space-y-2">
            <Label htmlFor="name">Position Name *</Label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter position name"
              className="bg-white dark:bg-white"
              required
            />
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
              {isEditing ? "New Password (optional)" : "Password"}
            </Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isEditing ? "Leave blank to keep current password" : "Enter password for this position"}
              className="bg-white dark:bg-white"
            />
            <p className="text-xs text-gray-600 mt-1">
              This password will be used for position-based authentication
              {(name.toLowerCase().includes('admin') || name.toLowerCase().includes('administrator')) && (
                <span className="block text-amber-600 mt-1 font-medium">
                  ⚠️ Admin positions must have unique passwords. Each admin position requires a different password for security.
                </span>
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