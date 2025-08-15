"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Position, UserProfile } from "@/lib/types"
import { authenticatedPost, authenticatedPut } from "@/lib/api-client"
import { toastSuccess, toastError } from "@/hooks/use-toast"

interface UserDialogProps {
  isOpen: boolean
  onClose: () => void
  user?: UserProfile | null
  positions: Position[]
  onSave: () => void
}

export function UserDialog({ isOpen, onClose, user, positions, onSave }: UserDialogProps) {
  const [email, setEmail] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [positionId, setPositionId] = useState("")
  const [role, setRole] = useState<"admin" | "viewer">("viewer")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const isEditing = Boolean(user)
  const title = isEditing ? "Edit User" : "Add User"

  useEffect(() => {
    if (user) {
      setEmail(user.id) // In this system, user ID is email
      setDisplayName(user.display_name || "")
      setPositionId(user.position_id || "no-position")
      setRole(user.role)
    } else {
      setEmail("")
      setDisplayName("")
      setPositionId("no-position")
      setRole("viewer")
    }
    setPassword("") // Always reset password field
  }, [user])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email.trim() || (!isEditing && !password)) {
      toastError("Validation Error", "Email and password are required")
      return
    }

    if (!isEditing && !email.includes('@')) {
      toastError("Validation Error", "Please enter a valid email address")
      return
    }

    setIsLoading(true)

    try {
      const data = {
        display_name: displayName.trim(),
        position_id: positionId === "no-position" ? null : positionId || null,
        role,
        ...(password && { password }),
        ...((!isEditing) && { id: email.trim() })
      }

      if (isEditing && user) {
        await authenticatedPut(`/api/user-profiles/${user.id}`, data)
        toastSuccess("User Updated", "User has been updated successfully")
      } else {
        await authenticatedPost('/api/user-profiles', data)
        toastSuccess("User Created", "User has been created successfully")
      }

      onSave()
      handleClose()
    } catch (error) {
      console.error('Error saving user:', error)
      
      // Extract error message from the response
      let errorMessage = "Failed to save user. Please try again."
      if (error instanceof Error) {
        errorMessage = error.message
      }
      
      toastError("Save Failed", errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    setEmail("")
    setDisplayName("")
    setPositionId("no-position")
    setRole("viewer")
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
            <Label htmlFor="email">Email Address *</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              className="bg-white dark:bg-white"
              disabled={isEditing}
              required
            />
            {isEditing && (
              <p className="text-xs text-gray-600 mt-1">Email cannot be changed</p>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="displayName">Display Name</Label>
            <Input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Enter display name"
              className="bg-white dark:bg-white"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="position">Position</Label>
            <Select value={positionId} onValueChange={setPositionId}>
              <SelectTrigger className="bg-white dark:bg-white">
                <SelectValue placeholder="Select a position" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="no-position">No position assigned</SelectItem>
                {positions.map((position) => (
                  <SelectItem key={position.id} value={position.id}>
                    {position.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select value={role} onValueChange={(value: "admin" | "viewer") => setRole(value)}>
              <SelectTrigger className="bg-white dark:bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="viewer">Viewer</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">
              {isEditing ? "New Password (optional)" : "Password *"}
            </Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isEditing ? "Leave blank to keep current password" : "Enter password"}
              className="bg-white dark:bg-white"
              required={!isEditing}
            />
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