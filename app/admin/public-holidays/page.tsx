"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/lib/auth"
import { Navigation } from "@/components/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { publicHolidaysApi } from "@/lib/api-client"
import { Plus, Trash2, Download, Upload, Calendar, RefreshCw } from "lucide-react"

interface PublicHoliday {
  date: string
  name: string
  region?: string
  source?: string
  created_at: string
}

export default function AdminPublicHolidaysPage() {
  const { user, isLoading: authLoading } = useAuth()
  const [holidays, setHolidays] = useState<PublicHoliday[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingHoliday, setEditingHoliday] = useState<PublicHoliday | null>(null)
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [newHoliday, setNewHoliday] = useState({
    date: '',
    name: '',
    region: 'NSW',
    source: 'manual'
  })

  useEffect(() => {
    // Wait for authentication to complete before loading data
    if (!authLoading && user) {
      loadHolidays()
    }
  }, [authLoading, user])

  const loadHolidays = async () => {
    setLoading(true)
    try {
      const data = await publicHolidaysApi.getAll()
      setHolidays(data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()))
    } catch (error) {
      console.error('Error loading holidays:', error)
      showAlert('error', 'Failed to load public holidays')
    } finally {
      setLoading(false)
    }
  }

  const showAlert = (type: 'success' | 'error', message: string) => {
    setAlert({ type, message })
    setTimeout(() => setAlert(null), 5000)
  }

  const handleSaveHoliday = async () => {
    if (!newHoliday.date || !newHoliday.name) {
      showAlert('error', 'Date and name are required')
      return
    }

    try {
      if (editingHoliday) {
        // Update existing holiday
        await publicHolidaysApi.update(editingHoliday.date, newHoliday)
        setHolidays(holidays.map(h => 
          h.date === editingHoliday.date ? { ...h, ...newHoliday } : h
        ))
        showAlert('success', 'Holiday updated successfully')
      } else {
        // Create new holiday
        await publicHolidaysApi.create(newHoliday)
        await loadHolidays() // Reload to get the full data
        showAlert('success', 'Holiday added successfully')
      }

      setIsDialogOpen(false)
      setEditingHoliday(null)
      setNewHoliday({ date: '', name: '', region: 'NSW', source: 'manual' })
    } catch (error) {
      console.error('Error saving holiday:', error)
      showAlert('error', 'Failed to save holiday')
    }
  }

  const handleDeleteHoliday = async (date: string) => {
    if (!confirm('Are you sure you want to delete this holiday? This may affect task scheduling.')) {
      return
    }

    try {
      await publicHolidaysApi.delete(date)
      setHolidays(holidays.filter(h => h.date !== date))
      showAlert('success', 'Holiday deleted successfully')
    } catch (error) {
      console.error('Error deleting holiday:', error)
      showAlert('error', 'Failed to delete holiday')
    }
  }

  const handleEditHoliday = (holiday: PublicHoliday) => {
    setEditingHoliday(holiday)
    setNewHoliday({
      date: holiday.date,
      name: holiday.name,
      region: holiday.region || 'NSW',
      source: holiday.source || 'manual'
    })
    setIsDialogOpen(true)
  }

  const handleImportHolidays = async () => {
    try {
      const response = await fetch('/api/public-holidays/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: new Date().getFullYear(), region: 'NSW' })
      })
      
      const result = await response.json()
      
      if (result.success) {
        await loadHolidays()
        showAlert('success', `Imported ${result.imported} holidays`)
      } else {
        showAlert('error', result.message || 'Failed to import holidays')
      }
    } catch (error) {
      console.error('Error importing holidays:', error)
      showAlert('error', 'Failed to import holidays')
    }
  }

  const exportHolidays = () => {
    const csv = [
      'Date,Name,Region,Source',
      ...holidays.map(h => `${h.date},"${h.name}",${h.region || ''},${h.source || ''}`)
    ].join('\n')
    
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `public-holidays-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  // Group holidays by year for display
  const holidaysByYear = holidays.reduce((acc, holiday) => {
    const year = new Date(holiday.date).getFullYear()
    if (!acc[year]) acc[year] = []
    acc[year].push(holiday)
    return acc
  }, {} as Record<number, PublicHoliday[]>)

  // Show loading spinner while authentication is still loading
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user || user.profile?.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Access Denied</h1>
          <p className="text-gray-600">You don't have permission to access this page.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      <Navigation />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="pharmacy-gradient rounded-lg p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-2">Public Holidays Management</h1>
                <p className="text-white/90">Manage public holidays that affect task scheduling</p>
              </div>
              <div className="flex space-x-3">
                <Button
                  onClick={() => {
                    setEditingHoliday(null)
                    setNewHoliday({ date: '', name: '', region: 'NSW', source: 'manual' })
                    setIsDialogOpen(true)
                  }}
                  className="bg-white text-blue-600 hover:bg-gray-100"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Holiday
                </Button>
                <Button
                  onClick={handleImportHolidays}
                  variant="outline"
                  className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Import NSW
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Alert */}
        {alert && (
          <Alert className={`mb-6 ${alert.type === 'success' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
            <AlertDescription className={alert.type === 'success' ? 'text-green-800' : 'text-red-800'}>
              {alert.message}
            </AlertDescription>
          </Alert>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="card-surface">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Holidays</p>
                  <p className="text-2xl font-bold">{holidays.length}</p>
                </div>
                <Calendar className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="card-surface">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">This Year</p>
                  <p className="text-2xl font-bold">
                    {holidaysByYear[new Date().getFullYear()]?.length || 0}
                  </p>
                </div>
                <Calendar className="w-8 h-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="card-surface">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Next Year</p>
                  <p className="text-2xl font-bold">
                    {holidaysByYear[new Date().getFullYear() + 1]?.length || 0}
                  </p>
                </div>
                <Calendar className="w-8 h-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <Card className="card-surface mb-6">
          <CardContent className="pt-6">
            <div className="flex justify-between items-center">
              <div className="flex space-x-2">
                <Button variant="outline" onClick={exportHolidays}>
                  <Download className="w-4 h-4 mr-2" />
                  Export CSV
                </Button>
                <Button variant="outline" onClick={loadHolidays}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh
                </Button>
              </div>
              
              <p className="text-sm text-gray-600">
                Holidays affect task scheduling and recurrence rules
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Holidays Table */}
        <Card className="card-surface">
          <CardHeader>
            <CardTitle>Public Holidays ({holidays.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-gray-600">Loading holidays...</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Day</TableHead>
                      <TableHead>Holiday Name</TableHead>
                      <TableHead>Region</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {holidays.map((holiday) => {
                      const date = new Date(holiday.date)
                      const dayOfWeek = date.toLocaleDateString('en-AU', { weekday: 'short' })
                      const isUpcoming = date > new Date()
                      const isPast = date < new Date()
                      
                      return (
                        <TableRow key={holiday.date} className={isPast ? 'opacity-60' : ''}>
                          <TableCell>
                            <div className={`font-mono ${isUpcoming ? 'text-blue-600 font-medium' : ''}`}>
                              {date.toLocaleDateString('en-AU')}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">{dayOfWeek}</span>
                          </TableCell>
                          <TableCell>
                            <span className="font-medium">{holiday.name}</span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">{holiday.region || '-'}</span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-gray-600">{holiday.source || 'manual'}</span>
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEditHoliday(holiday)}
                              >
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDeleteHoliday(holiday.date)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>

                {holidays.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-gray-600">No public holidays found.</p>
                    <p className="text-sm text-gray-500 mt-1">
                      Click "Import NSW" to automatically import Australian public holidays.
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add/Edit Holiday Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingHoliday ? 'Edit Holiday' : 'Add Public Holiday'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 p-4">
              <div>
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={newHoliday.date}
                  onChange={(e) => setNewHoliday({ ...newHoliday, date: e.target.value })}
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="name">Holiday Name</Label>
                <Input
                  id="name"
                  value={newHoliday.name}
                  onChange={(e) => setNewHoliday({ ...newHoliday, name: e.target.value })}
                  placeholder="e.g., Christmas Day"
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="region">Region</Label>
                <Input
                  id="region"
                  value={newHoliday.region}
                  onChange={(e) => setNewHoliday({ ...newHoliday, region: e.target.value })}
                  placeholder="e.g., NSW"
                />
              </div>
              
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveHoliday}>
                  {editingHoliday ? 'Update' : 'Add'} Holiday
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  )
}