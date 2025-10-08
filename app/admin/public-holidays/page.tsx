"use client"

import { useState, useEffect } from "react"
import { usePositionAuth } from "@/lib/position-auth-context"
import { Navigation } from "@/components/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"

import { publicHolidaysApi, authenticatedPost } from "@/lib/api-client"
import { supabase } from "@/lib/supabase"
import { Plus, Trash2, Edit, Download, Upload, Calendar, Search, X } from "lucide-react"
import { toastError, toastSuccess } from "@/hooks/use-toast"
import { getAustralianToday, getAustralianNow, parseAustralianDate, formatAustralianDate } from "@/lib/timezone-utils"

interface PublicHoliday {
  date: string
  name: string
  region?: string
  source?: string
  created_at: string
}

// Pagination Component
const Pagination = ({
  currentPage,
  totalPages,
  onPageChange
}: {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
}) => {
  if (totalPages <= 1) return null

  const getVisiblePages = () => {
    const pages = []
    const maxVisible = 5

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) {
          pages.push(i)
        }
        pages.push('...')
        pages.push(totalPages)
      } else if (currentPage >= totalPages - 2) {
        pages.push(1)
        pages.push('...')
        for (let i = totalPages - 3; i <= totalPages; i++) {
          pages.push(i)
        }
      } else {
        pages.push(1)
        pages.push('...')
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i)
        }
        pages.push('...')
        pages.push(totalPages)
      }
    }

    return pages
  }

  return (
    <div className="flex items-center justify-center space-x-2 py-4">
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="px-3 py-1"
      >
        Prev
      </Button>

      {getVisiblePages().map((page, index) => (
        <div key={index}>
          {page === '...' ? (
            <span className="px-3 py-1 text-gray-500">...</span>
          ) : (
            <Button
              variant={currentPage === page ? "default" : "outline"}
              size="sm"
              onClick={() => onPageChange(page as number)}
              className={`px-3 py-1 min-w-[40px] ${currentPage === page ? "bg-blue-500 text-white" : ""
                }`}
            >
              {page}
            </Button>
          )}
        </div>
      ))}

      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="px-3 py-1"
      >
        Next
      </Button>
    </div>
  )
}

export default function AdminPublicHolidaysPage() {
  const { user, isLoading: authLoading, isAdmin } = usePositionAuth()
  const [holidays, setHolidays] = useState<PublicHoliday[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingHoliday, setEditingHoliday] = useState<PublicHoliday | null>(null)

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)

  const [newHoliday, setNewHoliday] = useState({
    date: '',
    name: '',
    region: 'National',
    source: 'Manual'
  })

  // Delete confirmation dialog state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [holidayToDelete, setHolidayToDelete] = useState<PublicHoliday | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Bulk action state
  const [selectedHolidays, setSelectedHolidays] = useState<Set<string>>(new Set())
  const [bulkDeleteConfirmModal, setBulkDeleteConfirmModal] = useState(false)
  const [bulkActionLoading, setBulkActionLoading] = useState(false)

  // Import loading state
  const [isImporting, setIsImporting] = useState(false)

  // Pagination state - updated to support different page sizes
  const [holidaysPerPage, setHolidaysPerPage] = useState(50)

  // Search state
  const [searchTerm, setSearchTerm] = useState('')

  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Form validation errors
  const [formErrors, setFormErrors] = useState<{
    date?: string
    name?: string
  }>({})

  useEffect(() => {
    console.log('Public Holidays Page - useEffect triggered:', { authLoading, user: !!user })
    // Wait for authentication to complete before loading data
    if (!authLoading && user) {
      console.log('Public Holidays Page - Authentication complete, loading holidays')
      loadHolidays()
    } else {
      console.log('Public Holidays Page - Waiting for authentication...', { authLoading, hasUser: !!user })
    }
  }, [authLoading, user])

  const loadHolidays = async () => {
    console.log('Public Holidays Page - Starting to load holidays...')
    setLoading(true)
    try {
      console.log('Public Holidays Page - Calling publicHolidaysApi.getAll()')
      const data = await publicHolidaysApi.getAll()
      console.log('Public Holidays Page - Received data:', data)
      if (data && Array.isArray(data)) {
        console.log('Public Holidays Page - Data is valid array with', data.length, 'items')
        setHolidays(
          data.sort(
            (a, b) => parseAustralianDate(a.date).getTime() - parseAustralianDate(b.date).getTime()
          )
        )
      } else {
        console.warn('Public Holidays Page - No holidays data received or data is not an array:', data)
        setHolidays([])
      }
    } catch (error) {
      console.error('Public Holidays Page - Error loading holidays:', error)
      toastError('Error', 'Failed to load public holidays')
      setHolidays([])
    } finally {
      console.log('Public Holidays Page - Finished loading holidays')
      setLoading(false)
    }
  }



  const handleSaveHoliday = async () => {
    // Clear previous errors
    setFormErrors({})

    // Validate form fields
    const errors: { date?: string; name?: string } = {}

    if (!newHoliday.date || newHoliday.date.trim() === '') {
      errors.date = 'Date is required'
    }

    if (!newHoliday.name || newHoliday.name.trim() === '') {
      errors.name = 'Holiday name is required'
    }

    // If there are validation errors, show them and return
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }

    try {
      if (editingHoliday) {
        // Update existing holiday - pass original region for precise identification
        console.log('Updating holiday:', { editingHoliday, newHoliday })
        const updatedHoliday = await publicHolidaysApi.update(
          editingHoliday.date,
          newHoliday,
          editingHoliday.region,
          editingHoliday.name
        )
        if (updatedHoliday) {
          // Reload holidays to ensure consistency with database
          await loadHolidays()
          toastSuccess('Holiday Updated', 'Holiday updated successfully')
        } else {
          toastError('Update Failed', 'Failed to update holiday')
          return
        }
      } else {
        // Create new holiday
        const createdHoliday = await publicHolidaysApi.create(newHoliday)
        if (createdHoliday) {
          await loadHolidays() // Reload to get the full data
          toastSuccess('Holiday Added', 'Holiday added successfully')
        } else {
          toastError('Create Failed', 'Failed to create holiday')
          return
        }
      }

      setIsDialogOpen(false)
      setEditingHoliday(null)
      setNewHoliday({ date: '', name: '', region: 'National', source: 'Manual' })
      setFormErrors({}) // Clear errors on successful save
    } catch (error) {
      console.error('Error saving holiday:', error)
      toastError('Save Failed', 'Failed to save holiday')
    }
  }

  const handleDeleteHoliday = (holiday: PublicHoliday) => {
    setHolidayToDelete(holiday)
    setDeleteConfirmOpen(true)
  }

  const confirmDeleteHoliday = async () => {
    if (!holidayToDelete) return

    setIsDeleting(true)
    try {
      console.log('Deleting holiday:', holidayToDelete)

      // Use the API client which handles authentication properly
      const success = await publicHolidaysApi.delete(holidayToDelete.date, holidayToDelete.region)

      if (success) {
        // Filter out the deleted holiday using both date and region for precision
        setHolidays(holidays.filter(h =>
          !(h.date === holidayToDelete.date && h.region === holidayToDelete.region)
        ))
        toastSuccess('Holiday Deleted', 'Holiday deleted successfully')
      } else {
        console.error('Delete failed: API returned false')
        toastError('Delete Failed', 'Failed to delete holiday - please check console for details')
      }
    } catch (error) {
      console.error('Error deleting holiday:', error)
      const errorMessage = error.message || 'Unknown error'

      // Check if it's the audit constraint error and show helpful message
      if (errorMessage.includes('audit_log_action_check') || errorMessage.includes('Fix Audit')) {
        toastError('Database Fix Required', 'Please visit Admin > Fix Audit to resolve this issue')
      } else {
        toastError('Delete Failed', `Error: ${errorMessage}`)
      }
    } finally {
      setIsDeleting(false)
      setDeleteConfirmOpen(false)
      setHolidayToDelete(null)
    }
  }

  const handleEditHoliday = (holiday: PublicHoliday) => {
    setEditingHoliday(holiday)
    setNewHoliday({
      date: holiday.date,
      name: holiday.name,
      region: holiday.region || 'National',
      source: holiday.source || 'Manual'
    })
    setFormErrors({}) // Clear any existing errors
    setIsDialogOpen(true)
  }



  const handleImportHolidays = () => {
    // Create a hidden file input element
    const fileInput = document.createElement('input')
    fileInput.type = 'file'
    fileInput.accept = '.xlsx,.xls'
    fileInput.style.display = 'none'

    fileInput.onchange = async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0]
      if (!file) return

      setIsImporting(true)

      try {
        const formData = new FormData()
        formData.append('file', file)

        // Create authenticated headers for file upload
        const headers: HeadersInit = {}

        // Get authentication from Supabase
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.access_token) {
          headers.Authorization = `Bearer ${session.access_token}`
        }

        const response = await fetch('/api/public-holidays/import', {
          method: 'POST',
          body: formData,
          headers
        })

        const result = await response.json()

        if (result && result.success) {
          // Reload holidays immediately to show new records
          await loadHolidays()
          toastSuccess('Import Successful', `Imported ${result.imported} holidays`)
        } else {
          toastError('Import Failed', result?.message || 'Failed to import holidays')
        }
      } catch (error) {
        console.error('Error importing holidays:', error)
        const errorMessage = error instanceof Error ? error.message : 'Failed to import holidays'
        toastError('Import Failed', errorMessage)
      } finally {
        setIsImporting(false)
      }
    }

    // Trigger file selection
    document.body.appendChild(fileInput)
    fileInput.click()
    document.body.removeChild(fileInput)
  }

  const exportHolidays = async () => {
    try {
      // Import the XLSX library dynamically
      const XLSX = await import('xlsx')

      // Prepare data for Excel export
      const exportData = holidays.map(h => ({
        Date: h.date,
        Name: h.name,
        Region: h.region || '',
        Source: h.source || ''
      }))

      // Create workbook and worksheet
      const workbook = XLSX.utils.book_new()
      const worksheet = XLSX.utils.json_to_sheet(exportData)

      // Add the worksheet to the workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Public Holidays')

      // Generate Excel file and download (use Australian date)
      const fileName = `public-holidays-${formatAustralianDate(getAustralianNow())}.xlsx`
      XLSX.writeFile(workbook, fileName)
    } catch (error) {
      console.error('Error exporting to Excel:', error)
      toastError('Export Failed', 'Failed to export holidays to Excel')
    }
  }

  // Bulk action functions
  const getHolidayKey = (holiday: PublicHoliday) => `${holiday.date}-${holiday.region || 'NSW'}`

  const handleSelectHoliday = (holiday: PublicHoliday, checked: boolean) => {
    const holidayKey = getHolidayKey(holiday)
    const newSelected = new Set(selectedHolidays)
    if (checked) {
      newSelected.add(holidayKey)
    } else {
      newSelected.delete(holidayKey)
    }
    setSelectedHolidays(newSelected)
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedHolidays(new Set(paginatedHolidays.map(getHolidayKey)))
    } else {
      setSelectedHolidays(new Set())
    }
  }

  const handleBulkDelete = () => {
    if (selectedHolidays.size === 0) {
      toastError('No Selection', 'Please select holidays to delete')
      return
    }
    setBulkDeleteConfirmModal(true)
  }

  const confirmBulkDelete = async () => {
    setBulkDeleteConfirmModal(false)
    setBulkActionLoading(true)

    try {
      const selectedHolidayKeys = Array.from(selectedHolidays)
      const holidaysToDelete = holidays.filter(h => selectedHolidayKeys.includes(getHolidayKey(h)))

      // Delete all selected holidays
      await Promise.all(holidaysToDelete.map(holiday =>
        publicHolidaysApi.delete(holiday.date, holiday.region)
      ))

      // Remove from UI
      setHolidays(holidays.filter(h => !selectedHolidays.has(getHolidayKey(h))))
      setSelectedHolidays(new Set())

      toastSuccess('Bulk Delete Complete', `Successfully deleted ${holidaysToDelete.length} holiday(s)`)
    } catch (error) {
      console.error('Error in bulk delete:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      // Check if it's the audit constraint error and show helpful message
      if (errorMessage.includes('audit_log_action_check') || errorMessage.includes('Fix Audit')) {
        toastError('Database Fix Required', 'Please visit Admin > Fix Audit to resolve this issue')
      } else {
        toastError('Bulk Delete Failed', `Failed to delete holidays: ${errorMessage}`)
      }

      // Refresh data to ensure consistency
      await loadHolidays()
    } finally {
      setBulkActionLoading(false)
    }
  }

  // Search and filter logic
  const filteredHolidays = holidays.filter(holiday => {
    if (!searchTerm.trim()) return true

    const searchLower = searchTerm.toLowerCase()
    return (
      holiday.name.toLowerCase().includes(searchLower) ||
      holiday.date.includes(searchTerm) ||
      (holiday.region && holiday.region.toLowerCase().includes(searchLower)) ||
      (holiday.source && holiday.source.toLowerCase().includes(searchLower))
    )
  })

  // Pagination calculations based on filtered results
  const totalPages = Math.ceil(filteredHolidays.length / holidaysPerPage)
  const startIndex = (currentPage - 1) * holidaysPerPage
  const endIndex = startIndex + holidaysPerPage
  const paginatedHolidays = filteredHolidays.slice(startIndex, endIndex)

  // Reset to first page when holidays change, page size changes, or search term changes
  useEffect(() => {
    setCurrentPage(1)
  }, [holidays.length, holidaysPerPage, searchTerm])

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

  if (!user || !isAdmin) {
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

      <main className="max-w-content-lg mx-auto px-4 sm:px-6 lg:px-18 py-6 sm:py-8">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="pharmacy-gradient rounded-lg p-4 sm:p-6 text-white">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-2">Public Holidays Management</h1>
                <p className="text-white/90 text-sm sm:text-base">Manage public holidays that affect task scheduling</p>
              </div>
              <div className="flex-shrink-0">
                <Button
                  onClick={() => {
                    setEditingHoliday(null)
                    setNewHoliday({ date: '', name: '', region: 'National', source: 'Manual' })
                    setFormErrors({}) // Clear any existing errors
                    setIsDialogOpen(true)
                  }}
                  className="h-8 bg-white text-blue-600 hover:bg-gray-100 w-full sm:w-auto"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Holiday
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

        {/* Stats and Actions */}
        <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-3 mb-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <Card className="card-surface py-5 h-22">
              <CardContent className="px-4 sm:px-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Holidays</p>
                    <p className="text-xl sm:text-2xl font-bold">{holidays.length}</p>
                  </div>
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Calendar className="w-6 h-6 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="card-surface py-5 h-22">
              <CardContent className="px-4 sm:px-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">This Year</p>
                    <p className="text-xl sm:text-2xl font-bold">
                      {holidaysByYear[new Date().getFullYear()]?.length || 0}
                    </p>
                  </div>
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Calendar className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="card-surface py-5 h-22">
              <CardContent className="px-4 sm:px-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Next Year</p>
                    <p className="text-xl sm:text-2xl font-bold">
                      {holidaysByYear[getAustralianNow().getFullYear() + 1]?.length || 0}
                    </p>
                  </div>
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <Calendar className="w-6 h-6 text-orange-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          {/* Search and Actions */}
          <Card className="card-surface py-6 h-full">
            <CardContent className="px-4 sm:px-6">
              <div className="space-y-3 sm:space-y-0 sm:grid sm:grid-cols-1 lg:grid-cols-6 sm:gap-3">
                {/* Search Field */}
                <div className="relative lg:col-span-4">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Search holidays (name, date, region, source)..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-10"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      aria-label="Clear search"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-2 lg:col-span-2 lg:grid-cols-2">
                  <Button variant="outline" onClick={exportHolidays} className="w-full">
                    <Download className="w-4 h-4 mr-2" />
                    <span className="hidden sm:inline">Export</span>
                  </Button>
                  <Button
                    onClick={handleImportHolidays}
                    variant="outline"
                    className="w-full"
                    disabled={isImporting}
                  >
                    {isImporting ? (
                      <span className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-green-800 mr-2"></div>
                        <span className="hidden sm:inline">Importing...</span>
                        <span className="sm:hidden">...</span>
                      </span>
                    ) : (
                      <span className="flex items-center justify-center">
                        <Upload className="w-4 h-4 mr-2" />
                        <span className="hidden sm:inline">Import</span>
                      </span>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Holidays Table */}
        <Card className="card-surface w-full">
          <CardHeader>
            {/* <div className="flex flex-col space-y-4"> */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">

                <CardTitle className="text-lg lg:text-xl mb-1 mr-2">
                  Holidays ({filteredHolidays.length === 0 ? '0' : `${startIndex + 1}-${Math.min(endIndex, filteredHolidays.length)}`} of {filteredHolidays.length})
                  {searchTerm && filteredHolidays.length !== holidays.length && (
                    <span className="text-sm font-normal text-gray-600 ml-2">
                      (filtered from {holidays.length} total)
                    </span>
                  )}
                  {totalPages > 1 && (
                    <span className="text-sm font-normal text-gray-600 ml-2">
                      - Page {currentPage} of {totalPages}
                    </span>
                  )}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Per page:</span>
                  <Select value={String(holidaysPerPage)} onValueChange={(v) => { setHolidaysPerPage(parseInt(v, 10)); setCurrentPage(1); }}>
                    <SelectTrigger className="h-8 w-[110px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                      <SelectItem value="1000000">View All</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {/* Bulk Actions */}
              {selectedHolidays.size > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0 px-3">
                  <span className="text-sm font-medium text-gray-700 mr-2">
                    {selectedHolidays.size} holiday{selectedHolidays.size !== 1 ? 's' : ''} selected
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBulkDelete}
                    disabled={bulkActionLoading}
                    className="flex items-center space-x-1 text-red-600 hover:text-red-700 border-red-200 hover:border-red-300 w-full sm:w-auto"
                  >
                    {bulkActionLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                        <span>Deleting...</span>
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4" />
                        <span>Delete Selected</span>
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>


            {/* </div> */}
          </CardHeader>

          <CardContent className="p-0">
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-gray-600">Loading holidays...</p>
              </div>
            ) : paginatedHolidays.length === 0 ? (
              <div className="text-center py-8 px-4">
                {searchTerm ? (
                  <div className="text-gray-600">
                    <Search className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                    <p>No holidays found matching "{searchTerm}"</p>
                    <p className="text-sm text-gray-500 mt-1">
                      Try adjusting your search terms or clear the search to see all holidays.
                    </p>
                  </div>
                ) : holidays.length === 0 ? (
                  <div className="text-gray-600">
                    <Calendar className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                    <p>No public holidays found.</p>
                    <p className="text-sm text-gray-500 mt-1">
                      Click "Import" to automatically import Australian public holidays.
                    </p>
                  </div>
                ) : null}
              </div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden lg:block overflow-x-auto px-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[5%] py-4 bg-gray-50 text-center">
                          <Checkbox
                            checked={selectedHolidays.size === paginatedHolidays.length && paginatedHolidays.length > 0}
                            onCheckedChange={handleSelectAll}
                            aria-label="Select all holidays"
                            className="data-[state=checked]:bg-blue-500 data-[state=checked]:text-white data-[state=checked]:border-blue-500"
                          />
                        </TableHead>
                        <TableHead className="w-[15%] py-4 bg-gray-50 text-center">Date</TableHead>
                        <TableHead className="w-[10%] py-4 bg-gray-50 text-center">Day</TableHead>
                        <TableHead className="w-[25%] py-4 bg-gray-50 text-center">Holiday Name</TableHead>
                        <TableHead className="w-[15%] py-4 bg-gray-50 text-center">Region</TableHead>
                        <TableHead className="w-[15%] py-4 bg-gray-50 text-center">Source</TableHead>
                        <TableHead className="w-[15%] py-4 bg-gray-50 text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedHolidays.map((holiday) => {
                        const date = parseAustralianDate(holiday.date)
                        const dayOfWeek = date.toLocaleDateString('en-AU', { weekday: 'short', timeZone: 'Australia/Hobart' })
                        const australianNow = getAustralianNow()
                        const isUpcoming = date > australianNow
                        const isPast = date < australianNow

                        return (
                          <TableRow key={holiday.date} className={isPast ? 'opacity-60' : ''}>
                            <TableCell className="text-center">
                              <Checkbox
                                checked={selectedHolidays.has(getHolidayKey(holiday))}
                                onCheckedChange={(checked) => handleSelectHoliday(holiday, checked as boolean)}
                                aria-label={`Select holiday ${holiday.name}`}
                                className="data-[state=checked]:bg-blue-500 data-[state=checked]:text-white data-[state=checked]:border-blue-500"
                              />
                            </TableCell>
                            <TableCell>
                              <div className={`font-mono ${isUpcoming ? 'flex justify-center text-blue-600 font-medium' : 'flex justify-center'}`}>
                                {(() => { const y = date.getFullYear(); const m = String(date.getMonth() + 1).padStart(2, '0'); const d = String(date.getDate()).padStart(2, '0'); return `${d}-${m}-${y}`; })()}
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="flex justify-center text-sm">{dayOfWeek}</span>
                            </TableCell>
                            <TableCell>
                              <span className="flex justify-center font-medium">{holiday.name}</span>
                            </TableCell>
                            <TableCell>
                              <span className="flex justify-center text-sm">{holiday.region || '-'}</span>
                            </TableCell>
                            <TableCell>
                              <span className="flex justify-center text-sm text-gray-600">
                                {holiday.source === 'excel_import' ? 'Excel Import' : (holiday.source || 'Manual')}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="flex justify-center space-x-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleEditHoliday(holiday)}
                                  className="h-8 w-7"
                                  title="Edit holiday"
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleDeleteHoliday(holiday)}
                                  className="h-8 w-7 text-red-600 hover:text-red-700"
                                  title="Delete holiday"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile/Tablet Card Layout */}
                <div className="lg:hidden space-y-4 p-4">
                  {paginatedHolidays.map((holiday) => {
                    const date = parseAustralianDate(holiday.date)
                    const dayOfWeek = date.toLocaleDateString('en-AU', { weekday: 'long', timeZone: 'Australia/Hobart' })
                    const australianNow = getAustralianNow()
                    const isUpcoming = date > australianNow
                    const isPast = date < australianNow

                    return (
                      <Card key={holiday.date} className={`border border-gray-200 ${isPast ? 'opacity-60' : ''}`}>
                        <CardContent className="p-4">
                          <div className="space-y-3">
                            {/* Header with checkbox and name */}
                            <div className="flex items-start justify-between">
                              <div className="flex items-center space-x-3">
                                <Checkbox
                                  checked={selectedHolidays.has(getHolidayKey(holiday))}
                                  onCheckedChange={(checked) => handleSelectHoliday(holiday, checked as boolean)}
                                  aria-label={`Select holiday ${holiday.name}`}
                                  className="data-[state=checked]:bg-blue-500 data-[state=checked]:text-white data-[state=checked]:border-blue-500 mt-1"
                                />
                                <div>
                                  <h3 className="font-medium text-base">{holiday.name}</h3>
                                  <p className="text-sm text-gray-600">{dayOfWeek}</p>
                                </div>
                              </div>
                            </div>

                            {/* Details Grid */}
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="text-gray-500">Date:</span>
                                <div className={`font-mono mt-1 ${isUpcoming ? 'text-blue-600 font-medium' : ''}`}>
                                  {(() => { const y = date.getFullYear(); const m = String(date.getMonth() + 1).padStart(2, '0'); const d = String(date.getDate()).padStart(2, '0'); return `${d}-${m}-${y}`; })()}
                                </div>
                              </div>
                              <div>
                                <span className="text-gray-500">Region:</span>
                                <div className="mt-1">{holiday.region || '-'}</div>
                              </div>
                              <div className="col-span-2">
                                <span className="text-gray-500">Source:</span>
                                <div className="mt-1 text-gray-600">
                                  {holiday.source === 'excel_import' ? 'Excel Import' : (holiday.source || 'Manual')}
                                </div>
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex space-x-2 pt-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEditHoliday(holiday)}
                                className="flex-1"
                              >
                                <Edit className="w-4 h-4 mr-2" />
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDeleteHoliday(holiday)}
                                className="flex-1 text-red-600 hover:text-red-700 border-red-200 hover:border-red-300"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>

                {/* Pagination */}
                {filteredHolidays.length > 0 && totalPages > 1 && (
                  <div className="px-4 pb-4">
                    <Pagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      onPageChange={setCurrentPage}
                    />
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Add/Edit Holiday Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open)
          if (!open) {
            setFormErrors({}) // Clear errors when dialog is closed
          }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingHoliday ? 'Edit Holiday' : 'Add Public Holiday'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="date" className="p-1">Date *</Label>
                <Input
                  id="date"
                  type="date"
                  value={newHoliday.date}
                  onChange={(e) => {
                    setNewHoliday({ ...newHoliday, date: e.target.value })
                    // Clear error when user starts typing
                    if (formErrors.date) {
                      setFormErrors({ ...formErrors, date: undefined })
                    }
                  }}
                  className={formErrors.date ? 'border-red-500 focus:border-red-500' : ''}
                  required
                />
                {formErrors.date && (
                  <p className="text-red-500 text-sm mt-1">{formErrors.date}</p>
                )}
              </div>

              <div>
                <Label htmlFor="name" className="p-1">Holiday Name *</Label>
                <Input
                  id="name"
                  value={newHoliday.name}
                  onChange={(e) => {
                    setNewHoliday({ ...newHoliday, name: e.target.value })
                    // Clear error when user starts typing
                    if (formErrors.name) {
                      setFormErrors({ ...formErrors, name: undefined })
                    }
                  }}
                  placeholder="e.g., Christmas Day"
                  className={formErrors.name ? 'border-red-500 focus:border-red-500' : ''}
                  required
                />
                {formErrors.name && (
                  <p className="text-red-500 text-sm mt-1">{formErrors.name}</p>
                )}
              </div>

              <div className="mb-6">
                <Label htmlFor="region" className="p-1">Region</Label>
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
                <Button onClick={handleSaveHoliday} className="text-white">
                  {editingHoliday ? 'Update' : 'Add'} Holiday
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <ConfirmDeleteDialog
          isOpen={deleteConfirmOpen}
          onClose={() => {
            setDeleteConfirmOpen(false)
            setHolidayToDelete(null)
          }}
          onConfirm={confirmDeleteHoliday}
          title="Delete Public Holiday"
          description="Are you sure you want to delete this public holiday? This action cannot be undone and may affect task scheduling."
          itemName={holidayToDelete ? (() => { const date = parseAustralianDate(holidayToDelete.date); const y = date.getFullYear(); const m = String(date.getMonth() + 1).padStart(2, '0'); const d = String(date.getDate()).padStart(2, '0'); return `${holidayToDelete.name} (${d}-${m}-${y})`; })() : ''}
          isLoading={isDeleting}
        />

        {/* Bulk Delete Confirmation Modal */}
        <Dialog open={bulkDeleteConfirmModal} onOpenChange={setBulkDeleteConfirmModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-red-600 flex items-center">
                <Trash2 className="w-5 h-5 mr-2" />
                Delete Selected Holidays
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-gray-700">
                Are you sure you want to delete <strong>{selectedHolidays.size}</strong> selected holiday{selectedHolidays.size !== 1 ? 's' : ''}?
              </p>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-800 text-sm font-medium mb-2">This will permanently delete:</p>
                <ul className="text-red-700 text-sm space-y-1">
                  <li>• {selectedHolidays.size} public holiday{selectedHolidays.size !== 1 ? 's' : ''}</li>
                  <li>• May affect task scheduling and recurrence rules</li>
                </ul>
                <p className="text-red-800 text-sm font-medium mt-2">This action cannot be undone.</p>
              </div>
              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setBulkDeleteConfirmModal(false)}
                  disabled={bulkActionLoading}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={confirmBulkDelete}
                  disabled={bulkActionLoading}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {bulkActionLoading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  ) : (
                    <Trash2 className="w-4 h-4 mr-2" />
                  )}
                  Delete Holidays
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  )
}