"use client"

import { useState, useEffect, useRef } from "react"
import { useAuth } from "@/lib/auth"
import { Navigation } from "@/components/navigation"
import { MasterTaskForm } from "@/components/master-task-form"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

import { masterTasksApi, positionsApi, authenticatedGet } from "@/lib/api-client"
import { supabase } from "@/lib/supabase"
import * as XLSX from 'xlsx'
import { toastSuccess, toastError } from "@/hooks/use-toast"
import { 
  Plus, 
  Edit, 
  Trash2, 
  Calendar, 
  Clock, 
  Search,
  Download,
  Upload,
  Eye,
  EyeOff,
  Menu
} from "lucide-react"

interface MasterTask {
  id: string
  title: string
  description?: string
  frequency: string
  category?: string
  timing?: string
  publish_status: 'draft' | 'active' | 'inactive'
  default_due_time?: string
  position?: {
    id: string
    name: string
  }
  positions?: {
    id: string
    name: string
  }
  weekdays?: number[]
  months?: number[]
  sticky_once_off: boolean
  allow_edit_when_locked: boolean
  publish_delay_date?: string
}

interface Position {
  id: string
  name: string
}

const frequencyLabels = {
  once_off_sticky: 'Once-off Sticky',
  every_day: 'Every Day',
  weekly: 'Weekly',
  specific_weekdays: 'Specific Weekdays',
  start_every_month: 'Start Every Month',
  start_certain_months: 'Start Certain Months',
  every_month: 'Every Month',
  certain_months: 'Certain Months',
  end_every_month: 'End Every Month',
  end_certain_months: 'End Certain Months'
}

export default function AdminMasterTasksPage() {
  const { user, isLoading: authLoading } = useAuth()

  const [tasks, setTasks] = useState<MasterTask[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterPosition, setFilterPosition] = useState("all")
  const [filterStatus, setFilterStatus] = useState("all")
  const [filterCategory, setFilterCategory] = useState("all")
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<MasterTask | null>(null)
  const [formLoading, setFormLoading] = useState(false)
  const [showMobileFilters, setShowMobileFilters] = useState(false)
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null)
  const [generatingInstancesId, setGeneratingInstancesId] = useState<string | null>(null)
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{ isOpen: boolean; task: any | null }>({ isOpen: false, task: null })
  const [generateConfirmModal, setGenerateConfirmModal] = useState<{ isOpen: boolean; task: any | null }>({ isOpen: false, task: null })
  
  // File input ref for import functionality
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Wait for authentication to complete before loading data
    if (!authLoading && user && user.profile?.role === 'admin') {
      console.log('Authentication complete, loading data for admin user:', user.email)
      loadData()
    } else if (!authLoading && !user) {
      console.log('Authentication complete but no user found')
    } else if (!authLoading && user && user.profile?.role !== 'admin') {
      console.log('Authentication complete but user is not admin:', user.profile?.role)
    }
  }, [authLoading, user])

  const loadData = async () => {
    setLoading(true)
    try {
      console.log('Loading master tasks and positions...')
      const [tasksData, positionsData] = await Promise.all([
        masterTasksApi.getAll({ status: 'all' }), // Get all tasks for admin interface
        positionsApi.getAll()
      ])
      console.log('Loaded tasks:', tasksData.length)
      console.log('Loaded positions:', positionsData.length)
      setTasks(tasksData)
      setPositions(positionsData)
    } catch (error) {
      console.error('Error loading data:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      showToast('error', 'Loading Failed', `Failed to load data: ${errorMessage}`)
    } finally {
      setLoading(false)
    }
  }

  const showToast = (type: 'success' | 'error', title: string, description?: string) => {
    if (type === 'success') {
      toastSuccess(title, description)
    } else {
      toastError(title, description)
    }
  }

  const handleStatusChange = async (taskId: string, newStatus: 'draft' | 'active' | 'inactive') => {
    try {
      console.log('Updating task status:', { taskId, newStatus })
      
      // Optimistically update the UI first
      setTasks(tasks.map(task => 
        task.id === taskId ? { ...task, publish_status: newStatus } : task
      ))
      
      // Then update the database
      const updatedTask = await masterTasksApi.update(taskId, { publish_status: newStatus })
      console.log('Task status updated:', updatedTask)
      
      // Update with the full response from server (in case there are other changes)
      setTasks(tasks.map(task => 
        task.id === taskId ? updatedTask : task
      ))
      
      showToast('success', 'Status Updated', `Task status changed to ${newStatus}`)
    } catch (error) {
      console.error('Error updating task status:', error)
      
      // Revert the optimistic update on error
      await loadData()
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      showToast('error', 'Update Failed', `Failed to update task status: ${errorMessage}`)
    }
  }

  const handleDeleteTask = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId)
    setDeleteConfirmModal({ isOpen: true, task })
  }

  const confirmDeleteTask = async () => {
    const task = deleteConfirmModal.task
    if (!task) return

    setDeleteConfirmModal({ isOpen: false, task: null })
    setDeletingTaskId(task.id)
    
    try {
      console.log('Deleting task:', task.id)
      await masterTasksApi.delete(task.id)
      console.log('Task deleted successfully')
      
      // Immediately remove from UI
      setTasks(tasks.filter(t => t.id !== task.id))
      
      showToast('success', 'Task Deleted', `"${task.title}" was deleted successfully`)
    } catch (error) {
      console.error('Error deleting task:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      showToast('error', 'Delete Failed', `Failed to delete task: ${errorMessage}`)
    } finally {
      setDeletingTaskId(null)
    }
  }

  const handleSaveTask = async (taskData: any) => {
    setFormLoading(true)
    try {
      console.log('Saving task data:', taskData)
      
      if (editingTask) {
        // Update existing task
        console.log('Updating task:', editingTask.id)
        const updatedTask = await masterTasksApi.update(editingTask.id, taskData)
        console.log('Task updated:', updatedTask)
        
        // Immediately update the UI with the new data
        setTasks(tasks.map(task => 
          task.id === editingTask.id ? updatedTask : task
        ))
        
        showToast('success', 'Task Updated', 'Task was updated successfully')
      } else {
        // Create new task
        console.log('Creating new task')
        const newTask = await masterTasksApi.create(taskData)
        console.log('Task created:', newTask)
        
        // Immediately add the new task to the UI
        setTasks([newTask, ...tasks])
        
        showToast('success', 'Task Created', 'New task was created successfully')
      }
      
      // Close dialog and reset state
      setIsTaskDialogOpen(false)
      setEditingTask(null)
      
      // Optionally reload data to ensure consistency
      // await loadData()
      
    } catch (error) {
      console.error('Error saving task:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      showToast('error', `${editingTask ? 'Update' : 'Create'} Failed`, `Failed to ${editingTask ? 'update' : 'create'} task: ${errorMessage}`)
    } finally {
      setFormLoading(false)
    }
  }

  const handleCancelEdit = () => {
    // Reset form loading state
    setFormLoading(false)
    
    // Close dialog and reset editing state
    setIsTaskDialogOpen(false)
    setEditingTask(null)
    
    console.log('Edit dialog cancelled')
  }

  const handleGenerateInstances = (taskId?: string) => {
    const task = taskId ? tasks.find(t => t.id === taskId) : null
    setGenerateConfirmModal({ isOpen: true, task })
  }

  const confirmGenerateInstances = async () => {
    const task = generateConfirmModal.task
    const taskId = task?.id
    
    setGenerateConfirmModal({ isOpen: false, task: null })
    
    if (taskId) {
      setGeneratingInstancesId(taskId)
    }
    
    try {
      console.log('Generating instances for task:', taskId || 'all tasks')
      
      // Use authenticated API call
      const result = await authenticatedGet(`/api/jobs/generate-instances?mode=custom${taskId ? `&masterTaskId=${taskId}` : ''}`)
      
      if (!result) {
        throw new Error('Failed to generate instances')
      }
      
      if (result.success) {
        const message = taskId 
          ? `✅ Generated ${result.stats.generated} instances for "${task?.title}"`
          : `✅ Generated ${result.stats.generated} task instances`
        
        const details = result.stats.skipped > 0 
          ? ` (${result.stats.skipped} skipped as they already exist)`
          : ''
        
        showToast('success', 'Instances Generated', message + details)
      } else {
        showToast('error', 'Generation Failed', result.message || 'Failed to generate instances')
      }
    } catch (error) {
      console.error('Error generating instances:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate instances'
      showToast('error', 'Generation Failed', errorMessage)
    } finally {
      if (taskId) {
        setGeneratingInstancesId(null)
      }
    }
  }

  // Export handler function
  const handleExport = async () => {
    try {
      if (filteredTasks.length === 0) {
        showToast('error', 'Export Failed', 'No tasks to export')
        return
      }

      // Create export data from current filtered tasks
      const exportData = filteredTasks.map(task => ({
        'Title': task.title,
        'Description': task.description || '',
        'Position': task.positions?.name || task.position?.name || '',
        'Frequency': frequencyLabels[task.frequency as keyof typeof frequencyLabels] || task.frequency,
        'Category': task.category || '',
        'Status': task.publish_status,
        'Default Due Time': task.default_due_time || '',
        'Timing': task.timing || '',
        'Weekdays': task.weekdays?.join(',') || '',
        'Months': task.months?.join(',') || '',
        'Sticky Once Off': task.sticky_once_off ? 'Yes' : 'No',
        'Allow Edit When Locked': task.allow_edit_when_locked ? 'Yes' : 'No',
        'Publish Delay Date': task.publish_delay_date || ''
      }))

      // Create Excel workbook
      const worksheet = XLSX.utils.json_to_sheet(exportData)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Master Tasks')

      // Generate Excel file and download
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `master_tasks_export_${new Date().toISOString().split('T')[0]}.xlsx`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      showToast('success', 'Export Successful', `Exported ${exportData.length} master tasks to Excel`)
    } catch (error) {
      console.error('Error exporting tasks:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to export tasks'
      showToast('error', 'Export Failed', errorMessage)
    }
  }

  // Import handler function
  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      let importData: any[] = []
      const fileName = file.name.toLowerCase()

      if (fileName.endsWith('.csv')) {
        // Handle CSV files
        const text = await file.text()
        const lines = text.split('\n').filter(line => line.trim())
        
        if (lines.length < 2) {
          throw new Error('File must contain at least a header row and one data row')
        }

        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
        
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''))
          const row: any = {}
          
          headers.forEach((header, index) => {
            row[header] = values[index] || ''
          })
          
          importData.push(row)
        }
      } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        // Handle Excel files
        const arrayBuffer = await file.arrayBuffer()
        const workbook = XLSX.read(arrayBuffer, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        importData = XLSX.utils.sheet_to_json(worksheet)
      } else {
        throw new Error('Unsupported file format. Please use CSV or Excel files.')
      }

      if (importData.length === 0) {
        throw new Error('No data found in the file')
      }

      // Validate required headers
      const requiredHeaders = ['Title', 'Position', 'Frequency']
      const firstRow = importData[0]
      const availableHeaders = Object.keys(firstRow)
      
      const missingHeaders = requiredHeaders.filter(header => !availableHeaders.includes(header))
      if (missingHeaders.length > 0) {
        throw new Error(`Missing required columns: ${missingHeaders.join(', ')}`)
      }

      // Process and validate data
      const processedData = []
      for (let i = 0; i < importData.length; i++) {
        const row = importData[i]
        
        // Find position ID
        const position = positions.find(p => p.name === row['Position'])
        if (!position) {
          throw new Error(`Position "${row['Position']}" not found in row ${i + 2}`)
        }

        // Map data to master task format
        const taskData = {
          title: row['Title']?.toString().trim(),
          description: row['Description']?.toString().trim() || '',
          position_id: position.id,
          frequency: Object.keys(frequencyLabels).find(key => 
            frequencyLabels[key as keyof typeof frequencyLabels] === row['Frequency']
          ) || row['Frequency'],
          category: row['Category']?.toString().trim() || '',
          publish_status: (['draft', 'active', 'inactive'].includes(row['Status']) ? row['Status'] : 'draft') as 'draft' | 'active' | 'inactive',
          default_due_time: row['Default Due Time']?.toString().trim() || null,
          timing: row['Timing']?.toString().trim() || '',
          weekdays: row['Weekdays'] ? 
            row['Weekdays'].toString().split(',').map((w: string) => parseInt(w.trim())).filter((w: number) => !isNaN(w) && w >= 0 && w <= 6) : [],
          months: row['Months'] ? 
            row['Months'].toString().split(',').map((m: string) => parseInt(m.trim())).filter((m: number) => !isNaN(m) && m >= 1 && m <= 12) : [],
          sticky_once_off: row['Sticky Once Off']?.toString().toLowerCase() === 'yes',
          allow_edit_when_locked: row['Allow Edit When Locked']?.toString().toLowerCase() === 'yes',
          publish_delay_date: row['Publish Delay Date']?.toString().trim() || null
        }

        if (!taskData.title) {
          throw new Error(`Title is required in row ${i + 2}`)
        }

        processedData.push(taskData)
      }

      // Import tasks one by one
      let successCount = 0
      let errorCount = 0
      const errors: string[] = []
      
      for (let i = 0; i < processedData.length; i++) {
        const taskData = processedData[i]
        try {
          const newTask = await masterTasksApi.create(taskData)
          setTasks(prevTasks => [newTask, ...prevTasks])
          successCount++
        } catch (error) {
          console.error('Error importing task:', taskData.title, error)
          errorCount++
          errors.push(`Row ${i + 2}: ${taskData.title} - ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      }

      if (successCount > 0) {
        showToast('success', 'Import Successful', `Successfully imported ${successCount} tasks${errorCount > 0 ? ` (${errorCount} failed)` : ''}`)
        if (errors.length > 0 && errors.length <= 5) {
          console.log('Import errors:', errors)
        }
      } else {
        showToast('error', 'Import Failed', `${errorCount} tasks could not be imported`)
      }

    } catch (error) {
      console.error('Error importing file:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to import file'
      showToast('error', 'Import Failed', errorMessage)
    } finally {
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  // Filter tasks based on search and filters
  const filteredTasks = tasks.filter(task => {
    const matchesSearch = !searchTerm || 
      task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.description?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesPosition = filterPosition === 'all' || (task.positions?.id || task.position?.id) === filterPosition
    const matchesStatus = filterStatus === 'all' || task.publish_status === filterStatus
    const matchesCategory = filterCategory === 'all' || task.category === filterCategory

    return matchesSearch && matchesPosition && matchesStatus && matchesCategory
  })

  // Get unique categories for filter
  const categories = Array.from(new Set(tasks.map(task => task.category).filter(Boolean)))

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

  // Show access denied if user is not authenticated or not an admin
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

      <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6 lg:mb-8">
          <div className="pharmacy-gradient rounded-lg p-4 lg:p-6 text-white">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold mb-2">Master Tasks Management</h1>
                <p className="text-white/90 text-sm lg:text-base">Manage the central checklist that generates all task instances</p>
              </div>
              <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
                <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                  <Button 
                    onClick={() => handleGenerateInstances()} 
                    variant="outline"
                    disabled={generatingInstancesId !== null}
                    className="text-green-600 border-green-600 hover:bg-green-50 w-full sm:w-auto"
                  >
                    {generatingInstancesId === null ? (
                      <>
                        <Calendar className="w-4 h-4 mr-2" />
                        Generate All Instances
                      </>
                    ) : (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600 mr-2"></div>
                        Generating...
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={() => {
                      setEditingTask(null)
                      setIsTaskDialogOpen(true)
                    }}
                    className="bg-white text-blue-600 hover:bg-gray-100 w-full sm:w-auto"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    New Task
                  </Button>
                </div>

              </div>
            </div>
          </div>
        </div>





        {/* Filters */}
        <Card className="card-surface mb-6">
          <CardContent className="pt-4 pb-4">
            {/* Mobile Filter Toggle */}
            <div className="lg:hidden mb-4">
              <Button
                variant="outline"
                onClick={() => setShowMobileFilters(!showMobileFilters)}
                className="w-full justify-between"
              >
                <span className="flex items-center">
                  <Menu className="w-4 h-4 mr-2" />
                  Filters & Actions
                </span>
                {showMobileFilters ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>

            {/* Filters - Hidden on mobile unless toggled */}
            <div className={`${showMobileFilters ? 'block' : 'hidden'} lg:block`}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
                {/* Search Field - Wider than others */}
                <div className="relative lg:col-span-2">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Search tasks..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                
                {/* Position Filter */}
                <Select value={filterPosition} onValueChange={setFilterPosition}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Positions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Positions</SelectItem>
                    {positions?.map(position => (
                      <SelectItem key={position.id} value={position.id}>
                        {position.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Status Filter */}
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>

                {/* Category Filter */}
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories?.map(category => category && (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Export and Import Buttons - Same width */}
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" onClick={handleExport} className="w-full">
                    <Download className="w-4 h-4 mr-1" />
                    Export
                  </Button>
                  
                  <div className="relative">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleImport}
                      accept=".csv,.xlsx,.xls"
                      className="hidden"
                    />
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full"
                    >
                      <Upload className="w-4 h-4 mr-1" />
                      Import
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tasks Table */}
        <Card className="card-surface">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
              <CardTitle className="text-lg lg:text-xl">
                Master Tasks ({filteredTasks.length} of {tasks.length})
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-gray-600">Loading tasks...</p>
              </div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden lg:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Task</TableHead>
                        <TableHead>Position</TableHead>
                        <TableHead>Frequency</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Due Time</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTasks.map((task) => (
                        <TableRow key={task.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{task.title}</div>
                              {task.description && (
                                <div className="text-sm text-gray-600 truncate max-w-xs">
                                  {task.description}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">{task.positions?.name || task.position?.name || 'Unknown Position'}</span>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {frequencyLabels[task.frequency as keyof typeof frequencyLabels]}
                              {task.timing && (
                                <div className="text-xs text-gray-500">{task.timing}</div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {task.category ? (
                              <Badge variant="outline" className="text-xs">
                                {task.category}
                              </Badge>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Select
                              value={task.publish_status}
                              onValueChange={(value: 'draft' | 'active' | 'inactive') => 
                                handleStatusChange(task.id, value)
                              }
                            >
                              <SelectTrigger className="w-24">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="draft">Draft</SelectItem>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="inactive">Inactive</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center text-sm">
                              <Clock className="w-3 h-3 mr-1 text-gray-400" />
                              {task.default_due_time || '17:00'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleGenerateInstances(task.id)}
                                disabled={generatingInstancesId === task.id}
                                title="Generate instances for this task"
                              >
                                {generatingInstancesId === task.id ? (
                                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                                ) : (
                                  <Calendar className="w-3 h-3" />
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditingTask(task)
                                  setIsTaskDialogOpen(true)
                                }}
                              >
                                <Edit className="w-3 h-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDeleteTask(task.id)}
                                disabled={deletingTaskId === task.id}
                                className="text-red-600 hover:text-red-700"
                              >
                                {deletingTaskId === task.id ? (
                                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-red-600"></div>
                                ) : (
                                  <Trash2 className="w-3 h-3" />
                                )}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Card Layout */}
                <div className="lg:hidden space-y-4">
                  {filteredTasks.map((task) => (
                    <Card key={task.id} className="border border-gray-200">
                      <CardContent className="mobile-card p-4">
                        <div className="space-y-3">
                          {/* Title and Description */}
                          <div>
                            <h3 className="font-medium text-base">{task.title}</h3>
                            {task.description && (
                              <p className="text-sm text-gray-600 mt-1">{task.description}</p>
                            )}
                          </div>

                          {/* Details Grid */}
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <span className="text-gray-500">Position:</span>
                              <div className="font-medium">{task.positions?.name || task.position?.name || 'Unknown Position'}</div>
                            </div>
                            <div>
                              <span className="text-gray-500">Frequency:</span>
                              <div className="font-medium">
                                {frequencyLabels[task.frequency as keyof typeof frequencyLabels]}
                              </div>
                            </div>
                            <div>
                              <span className="text-gray-500">Category:</span>
                              <div>
                                {task.category ? (
                                  <Badge variant="outline" className="text-xs">
                                    {task.category}
                                  </Badge>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </div>
                            </div>
                            <div>
                              <span className="text-gray-500">Due Time:</span>
                              <div className="flex items-center font-medium">
                                <Clock className="w-3 h-3 mr-1 text-gray-400" />
                                {task.default_due_time || '17:00'}
                              </div>
                            </div>
                          </div>

                          {/* Status and Actions */}
                          <div className="flex flex-col space-y-3 pt-3 border-t">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <span className="text-sm text-gray-500">Status:</span>
                                <Select
                                  value={task.publish_status}
                                  onValueChange={(value: 'draft' | 'active' | 'inactive') => 
                                    handleStatusChange(task.id, value)
                                  }
                                >
                                  <SelectTrigger className="w-24 h-8">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="draft">Draft</SelectItem>
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="inactive">Inactive</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="flex space-x-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleGenerateInstances(task.id)}
                                  disabled={generatingInstancesId === task.id}
                                  title="Generate instances"
                                >
                                  {generatingInstancesId === task.id ? (
                                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                                  ) : (
                                    <Calendar className="w-3 h-3" />
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setEditingTask(task)
                                    setIsTaskDialogOpen(true)
                                  }}
                                >
                                  <Edit className="w-3 h-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleDeleteTask(task.id)}
                                  disabled={deletingTaskId === task.id}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  {deletingTaskId === task.id ? (
                                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-red-600"></div>
                                  ) : (
                                    <Trash2 className="w-3 h-3" />
                                  )}
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {filteredTasks.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-gray-600">No tasks found matching your filters.</p>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Task Creation/Edit Dialog */}
        <Dialog open={isTaskDialogOpen} onOpenChange={setIsTaskDialogOpen}>
          <DialogContent className="dialog-content max-w-6xl w-[95vw] sm:w-[90vw] max-h-[95vh] h-[95vh] overflow-hidden flex flex-col">
            <DialogHeader className="flex-shrink-0 pb-4 border-b">
              <DialogTitle className="text-xl font-semibold">
                {editingTask ? 'Edit Master Task' : 'Create New Master Task'}
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-hidden">
              <MasterTaskForm
                task={editingTask}
                positions={positions}
                onSave={handleSaveTask}
                onCancel={handleCancelEdit}
                loading={formLoading}
              />
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Modal */}
        <Dialog open={deleteConfirmModal.isOpen} onOpenChange={(open) => !open && setDeleteConfirmModal({ isOpen: false, task: null })}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-red-600 flex items-center">
                <Trash2 className="w-5 h-5 mr-2" />
                Delete Master Task
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-gray-700">
                Are you sure you want to delete <strong>"{deleteConfirmModal.task?.title}"</strong>?
              </p>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-800 text-sm font-medium mb-2">This will permanently delete:</p>
                <ul className="text-red-700 text-sm space-y-1">
                  <li>• The master task</li>
                  <li>• All associated task instances</li>
                  <li>• All completion history</li>
                </ul>
                <p className="text-red-800 text-sm font-medium mt-2">This action cannot be undone.</p>
              </div>
              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setDeleteConfirmModal({ isOpen: false, task: null })}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={confirmDeleteTask}
                  className="bg-red-600 hover:bg-red-700"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Task
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Generate Instances Confirmation Modal */}
        <Dialog open={generateConfirmModal.isOpen} onOpenChange={(open) => !open && setGenerateConfirmModal({ isOpen: false, task: null })}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-green-600 flex items-center">
                <Calendar className="w-5 h-5 mr-2" />
                Generate Task Instances
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {generateConfirmModal.task ? (
                <p className="text-gray-700">
                  Generate task instances for <strong>"{generateConfirmModal.task.title}"</strong>?
                </p>
              ) : (
                <p className="text-gray-700">
                  Generate task instances for <strong>all active tasks</strong>?
                </p>
              )}
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-green-800 text-sm font-medium mb-2">This will:</p>
                <ul className="text-green-700 text-sm space-y-1">
                  <li>• Create new task instances based on frequency settings</li>
                  <li>• Generate instances for the next 365 days</li>
                  <li>• Skip instances that already exist</li>
                </ul>
              </div>
              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setGenerateConfirmModal({ isOpen: false, task: null })}
                >
                  Cancel
                </Button>
                <Button
                  onClick={confirmGenerateInstances}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  Generate Instances
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  )
}