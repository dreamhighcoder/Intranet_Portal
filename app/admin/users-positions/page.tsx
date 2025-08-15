"use client"

import { useState, useEffect } from "react"
import { usePositionAuth } from "@/lib/position-auth-context"
import { Navigation } from "@/components/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Edit, Trash2, Plus, Users, Briefcase } from "lucide-react"
import { useRouter } from "next/navigation"
import { Position, UserProfile } from "@/lib/types"
import { positionsApi, authenticatedGet, authenticatedDelete } from "@/lib/api-client"
import { PositionAuthService } from "@/lib/position-auth"
import { PositionDialog } from "@/components/position-dialog"
import { UserDialog } from "@/components/user-dialog"
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import { toastSuccess, toastError } from "@/hooks/use-toast"

export default function UsersPositionsPage() {
  const { user, isLoading, isAdmin } = usePositionAuth()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<"positions" | "users">("positions")
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

  useEffect(() => {
    if (!isLoading && (!user || user.role !== "admin")) {
      router.push("/")
    }
  }, [user, isLoading, router])

  useEffect(() => {
    async function fetchData() {
      if (!isAdmin) return
      
      try {
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
      } finally {
        setIsLoadingData(false)
      }
    }

    fetchData()
  }, [user, isAdmin])

  const getPositionName = (positionId: string | undefined) => {
    return positions.find((p) => p.id === positionId)?.name || "Unknown"
  }

  // Count admin users for delete protection
  const adminCount = users.filter(user => user.role === "admin").length
  
  // Check if a user can be deleted (cannot delete last admin)
  const canDeleteUser = (user: UserProfile) => {
    if (user.role !== "admin") return true
    return adminCount > 1
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

      <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-2">Users & Positions</h1>
          <p className="text-[var(--color-text-secondary)]">
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
                <CardTitle>Positions</CardTitle>
                <Button 
                  className="bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 text-[var(--color-primary-on)]"
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
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Password</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {positions.map((position) => (
                    <TableRow key={position.id}>
                      <TableCell>
                        <div className="font-medium">{position.name}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-[var(--color-text-secondary)]">{position.description}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-mono text-sm text-[var(--color-text-muted)]">
                          {position.password_hash ? atob(position.password_hash) : 'Not set'}
                        </div>
                      </TableCell>
                      <TableCell>{new Date(position.created_at).toLocaleDateString("en-AU")}</TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleEditPosition(position)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeletePosition(position)}
                            className="text-red-600 hover:text-red-700 bg-transparent"
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
        {activeTab === "users" && (
          <Card className="card-surface">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Users</CardTitle>
                <Button 
                  className="bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 text-white"
                  onClick={handleAddUser}
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
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Last Login</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((userProfile) => (
                    <TableRow key={userProfile.id}>
                      <TableCell>
                        <div className="font-medium">{userProfile.display_name || 'N/A'}</div>
                      </TableCell>
                      <TableCell>{userProfile.id}</TableCell>
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
                        {userProfile.updated_at ? new Date(userProfile.updated_at).toLocaleDateString("en-AU") : "Never"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleEditUser(userProfile)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteUser(userProfile)}
                            className="text-red-600 hover:text-red-700 bg-transparent"
                            disabled={!canDeleteUser(userProfile)}
                            title={!canDeleteUser(userProfile) ? "Cannot delete the last administrator" : "Delete user"}
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