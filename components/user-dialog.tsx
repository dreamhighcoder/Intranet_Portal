"use client"

import { useState, useEffect } from "react"
import { usePositionAuth } from "@/lib/position-auth-context"
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
  const { isSuperAdmin } = usePositionAuth()
  const [email, setEmail] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [positionId, setPositionId] = useState("")
  const [role, setRole] = useState<"admin" | "viewer">("viewer")

  const [isLoading, setIsLoading] = useState(false)

  const isEditing = Boolean(user)
  const title = isEditing ? "Edit User" : "Add User"

  // Check if current user can assign admin role
  const canAssignAdminRole = () => {
    return isSuperAdmin
  }

  // Generate a secure temporary password
  const generateTemporaryPassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
    let password = ''
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return password
  }

  // Filter and consolidate positions for the dropdown
  const getFilteredPositions = () => {
    const nonAdminPositions = positions.filter(position => 
      !position.password_hash || position.name !== 'Administrator'
    )
    
    // Check if there are any admin positions
    const hasAdminPositions = positions.some(position => 
      position.password_hash && position.name === 'Administrator'
    )
    
    // Add a consolidated "Administrator" option if admin positions exist
    const consolidatedPositions = [...nonAdminPositions]
    if (hasAdminPositions) {
      consolidatedPositions.push({
        id: 'administrator-consolidated',
        name: 'Administrator',
        description: 'Administrative position',
        password_hash: null,
        is_super_admin: false,
        created_at: '',
        updated_at: ''
      })
    }
    
    return consolidatedPositions
  }

  useEffect(() => {
    if (user) {
      setEmail(user.email || user.id) // Use email field if available, fallback to ID
      setDisplayName(user.display_name || "")
      
      // Handle position mapping for admin positions
      let mappedPositionId = user.position_id || "no-position"
      if (user.position_id) {
        const userPosition = positions.find(p => p.id === user.position_id)
        if (userPosition && userPosition.password_hash && (
            userPosition.name.toLowerCase().includes('administrator') || 
            userPosition.name.toLowerCase().includes('admin')
          )) {
          mappedPositionId = "administrator-consolidated"
        }
      }
      setPositionId(mappedPositionId)
      
      // Regular admins cannot edit admin roles, so force to viewer if they can't assign admin role
      setRole(user.role === "admin" && !canAssignAdminRole() ? "viewer" : user.role)
    } else {
      setEmail("")
      setDisplayName("")
      setPositionId("no-position")
      setRole("viewer")
    }
  }, [user, isSuperAdmin, positions])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email.trim()) {
      toastError("Validation Error", "Email is required")
      return
    }

    if (!isEditing && !email.includes('@')) {
      toastError("Validation Error", "Please enter a valid email address")
      return
    }

    setIsLoading(true)

    try {
      // Handle position mapping for submission
      let submissionPositionId = positionId === "no-position" ? null : positionId || null
      if (positionId === "administrator-consolidated") {
        submissionPositionId = null // Let the API handle admin position assignment
      }
      
      const data = {
        display_name: displayName.trim(),
        position_id: submissionPositionId,
        role,
        ...(isEditing && { email: email.trim() }), // Include email for updates
        ...((!isEditing) && { 
          id: email.trim(),
          password: generateTemporaryPassword() // Generate temporary password for new users
        })
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
              required
            />
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
                {getFilteredPositions().map((position) => (
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
                <SelectItem value="admin" disabled={!canAssignAdminRole()}>
                  Admin {!canAssignAdminRole() && "(Super Admin only)"}
                </SelectItem>
              </SelectContent>
            </Select>
            {!canAssignAdminRole() && (
              <p className="text-xs text-amber-600 mt-1">
                Only Super Admins can create or promote users to admin role
              </p>
            )}
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