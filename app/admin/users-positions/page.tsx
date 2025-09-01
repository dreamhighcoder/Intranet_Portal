"use client"

import { useState, useEffect } from "react"
import { usePositionAuth } from "@/lib/position-auth-context"
import { Navigation } from "@/components/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Edit, Trash2, Plus, Users, Briefcase, Lock, Eye, EyeOff } from "lucide-react"
import { useRouter } from "next/navigation"
import { Position, UserProfile } from "@/lib/types"
import { positionsApi, authenticatedGet, authenticatedDelete } from "@/lib/api-client"
import { PositionAuthService } from "@/lib/position-auth"
import { PositionDialog } from "@/components/position-dialog"
import { UserDialog } from "@/components/user-dialog"
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import { toastSuccess, toastError } from "@/hooks/use-toast"

export default function UsersPositionsPage() {
  const { user, isLoading, isAdmin, isSuperAdmin } = usePositionAuth()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<"positions" | "users" | "order">("positions")
  const [positions, setPositions] = useState<Position[]>([])
  const [users, setUsers] = useState<UserProfile[]>([])
  const [isLoadingData, setIsLoadingData] = useState(true)
  
  // Dialog states
  const [positionDialogOpen, setPositionDialogOpen] = useState(false)
  const [userDialogOpen, setUserDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  
  // Selected items for editing
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null)
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null)
  const [itemToDelete, setItemToDelete] = useState<{ type: 'position' | 'user'; id: string; name: string } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  
  // Password visibility state for each position
  const [passwordVisibility, setPasswordVisibility] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (!isLoading && (!user || user.role !== "admin")) {
      router.push("/")
    }
  }, [user, isLoading, router])

  useEffect(() => {
    async function fetchData() {
      if (!isAdmin) return
      
      setIsLoadingData(true)
      try {
        // Fetch positions and users using authenticated API client
        const [positionsData, usersData] = await Promise.all([
          positionsApi.getAll(),
          authenticatedGet('/api/user-profiles')
        ])

        if (positionsData) {
          setPositions(positionsData)
        }

        if (usersData) {
          setUsers(usersData)
        }
      } catch (error) {
        console.error('Error fetching data:', error)
        toastError("Error", "Failed to fetch data")
      } finally {
        setIsLoadingData(false)
      }
    }

    fetchData()
  }, [isAdmin])

  const getPositionName = (positionId: string | undefined) => {
    return positions.find((p: Position) => p.id === positionId)?.name || "Unknown"
  }

  // Helper function to safely format dates with time
  const formatDateTime = (dateString: string | undefined | null) => {
    if (!dateString) return "Unknown"
    
    try {
      const date = new Date(dateString)
      if (isNaN(date.getTime())) {
        return "Invalid Date"
      }
      return date.toLocaleString("en-AU", {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      })
    } catch (error) {
      console.error("Error formatting date:", dateString, error)
      return "Invalid Date"
    }
  }

  // Helper function to safely format dates only (for backward compatibility)
  const formatDate = (dateString: string | undefined | null) => {
    if (!dateString) return "Unknown"
    
    try {
      const date = new Date(dateString)
      if (isNaN(date.getTime())) {
        return "Invalid Date"
      }
      return date.toLocaleDateString("en-AU")
    } catch (error) {
      console.error("Error formatting date:", dateString, error)
      return "Invalid Date"
    }
  }

  // Backward compatibility
  const formatCreatedDate = formatDateTime

  // Count total admins for delete protection (both user profiles and position-based)
  const adminUserCount = users.filter((user: UserProfile) => user.role === "admin").length
  const adminPositionCount = positions.filter((position: Position) => 
    position.name === 'Administrator'
  ).length
  
  const totalAdminCount = adminUserCount + adminPositionCount
  
  // Debug logging
  console.log("🔍 Admin count analysis:", {
    adminUserCount,
    adminPositionCount, 
    totalAdminCount,
    adminUsers: users.filter((user: UserProfile) => user.role === "admin").map((u: UserProfile) => ({
      id: u.id,
      displayName: u.display_name,
      role: u.role
    })),
    adminPositions: positions.filter((p: Position) => 
      p.password_hash && (p.name.toLowerCase().includes('administrator') || p.name.toLowerCase().includes('admin'))
    ).map((p: Position) => ({
      id: p.id,
      name: p.name,
      hasPassword: !!p.password_hash
    }))
  })
  
  // Permission check functions
  const canManageAdmins = () => {
    return isSuperAdmin
  }

  const canDeletePosition = (position: Position) => {
    // No one can delete the Super Administrator position
    if (position.is_super_admin) {
      return false
    }

    // Super admins can delete other positions (but super admin is already blocked above)
    if (isSuperAdmin) {
      return true
    }
    
    // Regular admins cannot delete Administrator position
    if (position.name === 'Administrator') {
      return false
    }
    
    // Regular admins can delete non-admin positions
    return true
  }

  const canDeleteUser = (userProfile: UserProfile) => {
    // Super admins can delete any user except themselves
    if (isSuperAdmin) {
      return userProfile.id !== user?.id
    }
    
    // Regular admins cannot delete admin users
    if (userProfile.role === 'admin') {
      return false
    }
    
    // Regular admins can delete non-admin users
    return true
  }

  const canEditUser = (userProfile: UserProfile) => {
    // Super admins can edit any user
    if (isSuperAdmin) {
      return true
    }
    
    // Regular admins can edit their own account
    if (userProfile.id === user?.id) {
      return true
    }
    
    // Regular admins cannot edit other admin users
    if (userProfile.role === 'admin') {
      return false
    }
    
    // Regular admins can edit non-admin users
    return true
  }

  const canAddUser = () => {
    // Both Super Admins and Regular Admins can add users
    // The restriction on admin role creation is handled in the API and UserDialog
    return isAdmin
  }

  // Check if current user can view password for a position
  const canViewPassword = (position: Position) => {
    // Super admins can view all passwords
    if (isSuperAdmin) {
      return true
    }
    
    // Regular admins cannot view Administrator password (unless it's their own by password match)
    if (position.name === 'Administrator') {
      if (user?.position?.password && position.password_hash) {
        const decodedPassword = atob(position.password_hash)
        return user.position.password === decodedPassword
      }
      return false
    }
    
    // Regular admins can view non-admin position passwords
    return true
  }

  // Check if current user can edit a position
  const canEditPosition = (position: Position) => {
    // Super admins can edit all positions
    if (isSuperAdmin) {
      return true
    }
    
    // Regular admins cannot edit Administrator position (unless it's their own by password match)
    if (position.name === 'Administrator') {
      // Check if this is their own position by comparing the password
      if (user?.position?.password && position.password_hash) {
        const decodedPassword = atob(position.password_hash)
        return user.position.password === decodedPassword
      }
      return false
    }
    
    // Regular admins can edit non-admin positions
    return true
  }

  // Toggle password visibility for a specific position
  const togglePasswordVisibility = (positionId: string) => {
    setPasswordVisibility(prev => ({
      ...prev,
      [positionId]: !prev[positionId]
    }))
  }

  // Get display password for a position
  const getDisplayPassword = (position: Position) => {
    if (!position.password_hash) {
      return "No password set"
    }
    
    if (!canViewPassword(position)) {
      return "••••••••"
    }
    
    const decodedPassword = atob(position.password_hash)
    const isVisible = passwordVisibility[position.id]
    
    return isVisible ? decodedPassword : "••••••••"
  }

  const refreshData = async () => {
    try {
      // Clear positions cache to ensure fresh data
      PositionAuthService.clearCache()
      
      const [positionsData, usersData] = await Promise.all([
        positionsApi.getAll(),
        authenticatedGet('/api/user-profiles')
      ])

      if (positionsData) {
        setPositions(positionsData)
      }

      if (usersData) {
        setUsers(usersData)
      }
    } catch (error) {
      console.error('Error refreshing data:', error)
    }
  }

  // Position handlers
  const handleAddPosition = () => {
    setSelectedPosition(null)
    setPositionDialogOpen(true)
  }

  const handleEditPosition = (position: Position) => {
    setSelectedPosition(position)
    setPositionDialogOpen(true)
  }

  const handleDeletePosition = (position: Position) => {
    console.log("=== DELETE POSITION CLICKED ===")
    console.log("Position to delete:", position)
    console.log("Position name:", position.name)
    console.log("Is admin position:", position.password_hash && 
      (position.name.toLowerCase().includes('administrator') || position.name.toLowerCase().includes('admin')))
    console.log("Can delete this position:", canDeletePosition(position))
    
    if (!canDeletePosition(position)) {
      console.log("DELETE BLOCKED: Cannot delete this position")
      toastError("Cannot Delete", "Cannot delete the last administrator position. At least one admin (user or position) must remain.")
      return
    }
    
    setItemToDelete({ type: 'position', id: position.id, name: position.name })
    setDeleteDialogOpen(true)
  }

  // User handlers
  const handleAddUser = () => {
    setSelectedUser(null)
    setUserDialogOpen(true)
  }

  const handleEditUser = (user: UserProfile) => {
    setSelectedUser(user)
    setUserDialogOpen(true)
  }

  const handleDeleteUser = (user: UserProfile) => {
    console.log("=== DELETE USER CLICKED ===")
    console.log("User to delete:", user)
    console.log("User role:", user.role)
    console.log("Current admin count:", totalAdminCount)
    console.log("Can delete this user:", canDeleteUser(user))
    
    if (!canDeleteUser(user)) {
      console.log("DELETE BLOCKED: Cannot delete this user")
      toastError("Cannot Delete", "Cannot delete the last administrator. At least one admin (user or position) must remain.")
      return
    }
    
    setItemToDelete({ type: 'user', id: user.id, name: user.display_name || user.id })
    setDeleteDialogOpen(true)
  }

  // Delete confirmation handler
  const handleConfirmDelete = async () => {
    if (!itemToDelete) return

    setIsDeleting(true)
    
    try {
      const endpoint = itemToDelete.type === 'position' 
        ? `/api/positions/${itemToDelete.id}`
        : `/api/user-profiles/${itemToDelete.id}`
      
      await authenticatedDelete(endpoint)
      
      toastSuccess(
        `${itemToDelete.type === 'position' ? 'Position' : 'User'} Deleted`,
        `${itemToDelete.name} has been deleted successfully`
      )
      
      // Clear positions cache if a position was deleted
      if (itemToDelete.type === 'position') {
        PositionAuthService.clearCache()
      }
      
      await refreshData()
      setDeleteDialogOpen(false)
      setItemToDelete(null)
    } catch (error) {
      console.error('Error deleting item:', error)
      toastError(
        "Delete Failed", 
        `Failed to delete ${itemToDelete.type}. Please try again.`
      )
    } finally {
      setIsDeleting(false)
    }
  }

  if (isLoading || isLoadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary)] mx-auto"></div>
          <p className="mt-2 text-[var(--color-text-secondary)]">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user || !isAdmin) return null

  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      <Navigation />
      <main className="max-w-content-lg mx-auto px-4 sm:px-6 lg:px-18 py-6 sm:py-8">
        <div className="pharmacy-gradient rounded-lg p-4 sm:p-6 text-white mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">Positions & Users</h1>
          <p className="text-white/90 text-sm sm:text-base">
            Manage staff positions and user accounts for the pharmacy system
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
          <button
            onClick={() => setActiveTab("positions")}
            className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === "positions"
                ? "bg-white text-[var(--color-primary)] shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <Briefcase className="w-4 h-4" />
            <span>Positions</span>
          </button>
          <button
            onClick={() => setActiveTab("order")}
            className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === "order"
                ? "bg-white text-[var(--color-primary)] shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
            title="Reorder positions (excluding Administrator)"
          >
            <Briefcase className="w-4 h-4" />
            <span>Position Order</span>
          </button>
          <button
            onClick={() => setActiveTab("users")}
            className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === "users"
                ? "bg-white text-[var(--color-primary)] shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Users</span>
          </button>
        </div>

        {/* Positions Tab */}
        {activeTab === "positions" && (
          <Card className="card-surface">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>
                  Positions {totalAdminCount > 0 && (
                    <span className="text-sm font-normal text-gray-500 ml-2">
                      ({adminUserCount} user admin{adminUserCount !== 1 ? 's' : ''}{adminPositionCount > 0 ? `, ${adminPositionCount} position admin${adminPositionCount !== 1 ? 's' : ''}` : ''})
                    </span>
                  )}
                </CardTitle>
                <Button 
                  className="bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 text-white"
                  onClick={handleAddPosition}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Position
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[15%] py-3 bg-gray-50">Name</TableHead>
                    <TableHead className="w-[30%] py-3 bg-gray-50">Description</TableHead>
                    <TableHead className="w-[10%] py-3 bg-gray-50">Type</TableHead>
                    <TableHead className="w-[10%] py-3 bg-gray-50">Password</TableHead>
                    <TableHead className="w-[15%] py-3 bg-gray-50">Created</TableHead>
                    <TableHead className="w-[15%] py-3 bg-gray-50">Updated</TableHead>
                    <TableHead className="w-[10%] py-3 bg-gray-50 text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {positions.map((position) => (
                    <TableRow key={position.id}>
                      <TableCell>
                        <div className="font-medium">{position.name}</div>
                      </TableCell>
                      <TableCell>{position.description || 'N/A'}</TableCell>
                      <TableCell>
                        <Badge
                          className={
                            position.name === 'Administrator'
                              ? "bg-purple-100 text-purple-800 border-purple-200"
                              : "bg-blue-100 text-blue-800 border-blue-200"
                          }
                        >
                          {position.name === 'Administrator'
                            ? (position.is_super_admin ? "Super Admin" : "Admin")
                            : "Position"
                          }
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {!canViewPassword(position) ? (
                            <div className="flex items-center space-x-2 text-gray-500">
                              <Lock className="w-4 h-4" />
                              <span className="text-sm">Protected</span>
                            </div>
                          ) : (
                            <>
                              <span className="font-mono text-sm">
                                {getDisplayPassword(position)}
                              </span>
                              {position.password_hash && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => togglePasswordVisibility(position.id)}
                                  className="h-6 w-6 p-0 hover:bg-gray-100"
                                  title={passwordVisibility[position.id] ? "Hide password" : "Show password"}
                                >
                                  {passwordVisibility[position.id] ? (
                                    <EyeOff className="w-3 h-3" />
                                  ) : (
                                    <Eye className="w-3 h-3" />
                                  )}
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="justify-center">{formatDateTime(position.created_at)}</TableCell>
                      <TableCell className="justify-center">{formatDateTime(position.updated_at)}</TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleEditPosition(position)}
                            disabled={!canEditPosition(position)}
                            className={!canEditPosition(position) ? "text-gray-400 hover:text-gray-400 bg-gray-50 cursor-not-allowed" : ""}
                            title={!canEditPosition(position) ? "Cannot edit other admin positions" : "Edit position"}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeletePosition(position)}
                            className={`${!canDeletePosition(position)
                              ? "text-gray-400 hover:text-gray-400 bg-gray-50 cursor-not-allowed" 
                              : "text-red-600 hover:text-red-700 bg-transparent"
                            }`}
                            disabled={!canDeletePosition(position)}
                            title={!canDeletePosition(position) ? 
                              (position.is_super_admin ? "Cannot delete Super Admin position" : "Cannot delete admin position") 
                              : "Delete position"
                            }
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Users Tab */}
        {activeTab === "order" && (
          <Card className="card-surface">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Reorder Positions</CardTitle>
                <Button 
                  className="bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 text-white"
                  onClick={async () => {
                    try {
                      // Build new order for non-admin positions only
                      const nonAdmin = positions
                        .filter(p => !p.name.toLowerCase().includes('administrator') && !p.name.toLowerCase().includes('admin'))
                        .sort((a, b) => (a.display_order ?? 9999) - (b.display_order ?? 9999) || a.name.localeCompare(b.name))

                      const payload = nonAdmin.map((p, idx) => ({ id: p.id, display_order: idx + 1 }))
                      await positionsApi.reorder(payload)
                      toastSuccess('Saved', 'Display order updated successfully')
                      PositionAuthService.clearCache()
                      await refreshData()
                    } catch (e) {
                      console.error(e)
                      toastError('Error', 'Failed to save display order')
                    }
                  }}
                >
                  Save Order
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">Drag and drop to reorder regular positions. Administrator positions are excluded.</p>
              {/* Simple drag-and-drop without extra libs */}
              <ul>
                {positions
                  .filter(p => p.name !== 'Administrator')
                  .sort((a, b) => (a.display_order ?? 9999) - (b.display_order ?? 9999) || a.name.localeCompare(b.name))
                  .map((p, idx) => (
                    <li
                      key={p.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', p.id)
                      }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault()
                        const draggedId = e.dataTransfer.getData('text/plain')
                        if (!draggedId || draggedId === p.id) return
                        // Reorder positions array in local state
                        setPositions(prev => {
                          const nonAdmin = prev.filter(x => x.name !== 'Administrator')
                          const admins = prev.filter(x => x.name === 'Administrator')
                          const fromIndex = nonAdmin.findIndex(x => x.id === draggedId)
                          const toIndex = nonAdmin.findIndex(x => x.id === p.id)
                          if (fromIndex === -1 || toIndex === -1) return prev
                          const next = nonAdmin.slice()
                          const [moved] = next.splice(fromIndex, 1)
                          next.splice(toIndex, 0, moved)
                          // Reassign display_order locally
                          const reindexed = next.map((item, i) => ({ ...item, display_order: i + 1 }))
                          // Merge back admins (unchanged)
                          return [...reindexed, ...admins]
                        })
                      }}
                      className="flex items-center justify-between p-3 mb-2 bg-white rounded-md border cursor-move"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-gray-500 w-6 text-right">{idx + 1}</span>
                        <span className="font-medium">{p.name}</span>
                      </div>
                      <span className="text-xs text-gray-400">order: {p.display_order ?? '-'}</span>
                    </li>
                  ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {activeTab === "users" && (
          <Card className="card-surface">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>
                  Users {totalAdminCount > 0 && (
                    <span className="text-sm font-normal text-gray-500 ml-2">
                      ({adminUserCount} user admin{adminUserCount !== 1 ? 's' : ''}{adminPositionCount > 0 ? `, ${adminPositionCount} position admin${adminPositionCount !== 1 ? 's' : ''}` : ''})
                    </span>
                  )}
                </CardTitle>
                <Button 
                  className="bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 text-white"
                  onClick={handleAddUser}
                  disabled={!canAddUser()}
                  title={!canAddUser() ? "Admin access required to add users" : "Add User"}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add User
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[20%] py-3 bg-gray-50">Name</TableHead>
                    <TableHead className="w-[20%] py-3 bg-gray-50">Email</TableHead>
                    <TableHead className="w-[20%] py-3 bg-gray-50">Position</TableHead>
                    <TableHead className="w-[10%] py-3 bg-gray-50">Role</TableHead>
                    <TableHead className="w-[20%] py-3 bg-gray-50">Last Login</TableHead>
                    <TableHead className="w-[10%] py-3 bg-gray-50">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((userProfile) => (
                    <TableRow key={userProfile.id}>
                      <TableCell>
                        <div className="font-medium">{userProfile.display_name || 'N/A'}</div>
                      </TableCell>
                      <TableCell>{userProfile.email || userProfile.id}</TableCell>
                      <TableCell>{getPositionName(userProfile.position_id)}</TableCell>
                      <TableCell>
                        <Badge
                          className={
                            userProfile.role === "admin"
                              ? "bg-purple-100 text-purple-800 border-purple-200"
                              : "bg-blue-100 text-blue-800 border-blue-200"
                          }
                        >
                          {userProfile.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {userProfile.last_login 
                          ? formatDateTime(userProfile.last_login)
                          : (formatDateTime(userProfile.updated_at) !== "Unknown" ? formatDateTime(userProfile.updated_at) : "Never")
                        }
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleEditUser(userProfile)}
                            disabled={!canEditUser(userProfile)}
                            className={!canEditUser(userProfile) ? "text-gray-400 hover:text-gray-400 bg-gray-50 cursor-not-allowed" : ""}
                            title={!canEditUser(userProfile) ? "Cannot edit other admin users" : "Edit user"}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteUser(userProfile)}
                            className={`${!canDeleteUser(userProfile) 
                              ? "text-gray-400 hover:text-gray-400 bg-gray-50 cursor-not-allowed" 
                              : "text-red-600 hover:text-red-700 bg-transparent"
                            }`}
                            disabled={!canDeleteUser(userProfile)}
                            title={!canDeleteUser(userProfile) ? 
                              (userProfile.role === 'admin' ? "Cannot delete admin users" : "Cannot delete the last administrator") 
                              : "Delete user"
                            }
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Dialogs */}
        <PositionDialog
          isOpen={positionDialogOpen}
          onClose={() => setPositionDialogOpen(false)}
          position={selectedPosition}
          onSave={refreshData}
        />

        <UserDialog
          isOpen={userDialogOpen}
          onClose={() => setUserDialogOpen(false)}
          user={selectedUser}
          positions={positions}
          onSave={refreshData}
        />

        <ConfirmDeleteDialog
          isOpen={deleteDialogOpen}
          onClose={() => setDeleteDialogOpen(false)}
          onConfirm={handleConfirmDelete}
          title={`Delete ${itemToDelete?.type === 'position' ? 'Position' : 'User'}`}
          description={`Are you sure you want to delete this ${itemToDelete?.type}? This action cannot be undone.`}
          itemName={itemToDelete?.name}
          isLoading={isDeleting}
        />
      </main>
    </div>
  )
}