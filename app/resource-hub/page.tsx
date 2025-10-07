'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { usePositionAuth } from '@/lib/position-auth-context'
import { Navigation } from '@/components/navigation'
import { PublicNavigation } from '@/components/public-navigation'
import { PositionLoginModal } from '@/components/position-login-modal'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Search,
  Plus,
  Upload,
  BookOpen,
  Edit,
  Trash2,
  FileText,
  ExternalLink,
  Filter,
  ArrowUpDown,
  X as XIcon,
  ChevronDown,
  Home
} from 'lucide-react'
import { toastSuccess, toastError } from '@/hooks/use-toast'
import * as XLSX from 'xlsx'
import { authenticatedPost, authenticatedPut, authenticatedDelete, authenticatedGet } from '@/lib/api-client'
import { supabase } from '@/lib/supabase'
import { PositionAuthService } from '@/lib/position-auth'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'

// Document Category configuration - ONLY for policy documents
const DOCUMENT_CATEGORY_CONFIG: Record<string, { label: string; emoji: string; color: string }> = {
  'hr': { label: 'HR', emoji: '👥', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  'stock-control': { label: 'Stock Control', emoji: '📦', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  'policies': { label: 'Policies', emoji: '📋', color: 'bg-gray-100 text-gray-800 border-gray-200' }
}

// Task Category configuration - for grouping master tasks
const TASK_CATEGORY_CONFIG: Record<string, { label: string; emoji: string }> = {
  'stock-control': { label: 'Stock Control', emoji: '📦' },
  'compliance': { label: 'Compliance', emoji: '☑️' },
  'cleaning': { label: 'Cleaning', emoji: '🧹' },
  'pharmacy-services': { label: 'Pharmacy Services', emoji: '💉' },
  'fos-operations': { label: 'FOS Operations', emoji: '🛍️' },
  'dispensary-operations': { label: 'Dispensary Operations', emoji: '💊' },
  'general-pharmacy-operations': { label: 'General Pharmacy Operations', emoji: '🌀' },
  'business-management': { label: 'Business Management', emoji: '📊' }
}

const DOCUMENT_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  'general-policy': { label: 'General Policy', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  'task-instruction': { label: 'Task Instruction', color: 'bg-green-50 text-green-700 border-green-200' }
}

interface PolicyDocument {
  id: string
  title: string
  document_url: string
  category: string
  document_type: string
  description?: string
  created_at: string
  updated_at: string
  linked_tasks?: any[]
  is_new?: boolean
}

interface MasterTask {
  id: string
  title: string
  description: string
  categories: string[]
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
        Previous
      </Button>

      {getVisiblePages().map((page, index) => (
        <div key={index}>
          {page === '...' ? (
            <span className="px-2 text-gray-500">...</span>
          ) : (
            <Button
              variant="outline"
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

export default function ResourceHubPage() {
  const { user, isLoading } = usePositionAuth()
  const router = useRouter()
  const isAdmin = user?.role === 'admin'
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false)

  const [documents, setDocuments] = useState<PolicyDocument[]>([])
  const [masterTasks, setMasterTasks] = useState<MasterTask[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [filterType, setFilterType] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'title' | 'category' | 'date'>('title')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [taskSearchQuery, setTaskSearchQuery] = useState('')

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingDocument, setEditingDocument] = useState<PolicyDocument | null>(null)

  // Bulk selection states
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set())
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false)
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(null)
  const [isDeletingBulk, setIsDeletingBulk] = useState(false)

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)
  const [documentsPerPage, setDocumentsPerPage] = useState(100)

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Form states
  const [formData, setFormData] = useState({
    title: '',
    document_url: '',
    category: 'hr',
    document_type: 'general-policy',
    linked_tasks: [] as string[]
  })

  // Load documents
  useEffect(() => {
    console.log('🔍 useEffect triggered - isAdmin:', isAdmin, 'isLoading:', isLoading)
    loadDocuments()
    if (isAdmin) {
      console.log('✅ Calling loadMasterTasks because user is admin')
      loadMasterTasks()
    } else {
      console.log('⚠️ NOT calling loadMasterTasks - user is not admin')
    }
  }, [isAdmin])

  // Auto-update document_type based on linked_tasks
  useEffect(() => {
    const newDocumentType = formData.linked_tasks.length > 0 ? 'task-instruction' : 'general-policy'
    if (formData.document_type !== newDocumentType) {
      setFormData(prev => ({ ...prev, document_type: newDocumentType }))
    }
  }, [formData.linked_tasks])

  const loadDocuments = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/resource-hub')
      const result = await response.json()

      if (result.success) {
        // Load linked tasks for each document
        const docsWithLinks = await Promise.all(
          result.data.map(async (doc: PolicyDocument) => {
            try {
              const linksResponse = await fetch(`/api/resource-hub/document-links/${doc.id}`)
              const linksResult = await linksResponse.json()
              return {
                ...doc,
                linked_tasks: linksResult.success ? linksResult.data : []
              }
            } catch (error) {
              return { ...doc, linked_tasks: [] }
            }
          })
        )
        setDocuments(docsWithLinks)
      } else {
        toastError('Failed to load documents')
      }
    } catch (error) {
      console.error('Error loading documents:', error)
      toastError('Failed to load documents')
    } finally {
      setLoading(false)
    }
  }

  const loadMasterTasks = async () => {
    try {
      console.log('🔍 Loading master tasks with authentication...')
      const result = await authenticatedGet('/api/master-tasks?status=all')
      console.log('🔍 Master tasks API response:', {
        isArray: Array.isArray(result),
        count: Array.isArray(result) ? result.length : 0,
        firstTask: Array.isArray(result) && result.length > 0 ? result[0] : null
      })
      if (Array.isArray(result)) {
        console.log('✅ Setting master tasks:', result.length)
        setMasterTasks(result)
      } else if (result === null) {
        console.warn('⚠️ API returned null - authentication may have failed')
      } else {
        console.warn('⚠️ API response is not an array:', result)
      }
    } catch (error) {
      console.error('❌ Error loading master tasks:', error)
    }
  }

  // Filter and sort documents
  const filteredAndSortedDocuments = useMemo(() => {
    let filtered = documents.filter(doc => {
      const matchesSearch = doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.description?.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesCategory = filterCategory === 'all' || doc.category === filterCategory
      const matchesType = filterType === 'all' || doc.document_type === filterType
      return matchesSearch && matchesCategory && matchesType
    })

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0
      if (sortBy === 'title') {
        comparison = a.title.localeCompare(b.title)
      } else if (sortBy === 'category') {
        comparison = a.category.localeCompare(b.category)
      } else if (sortBy === 'date') {
        comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      }
      return sortOrder === 'asc' ? comparison : -comparison
    })

    return filtered
  }, [documents, searchQuery, filterCategory, filterType, sortBy, sortOrder])

  // Pagination calculations
  const totalPages = Math.ceil(filteredAndSortedDocuments.length / documentsPerPage)
  const startIndex = (currentPage - 1) * documentsPerPage
  const endIndex = startIndex + documentsPerPage
  const paginatedDocuments = filteredAndSortedDocuments.slice(startIndex, endIndex)

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, filterCategory, filterType])

  // Group documents by category
  const groupedDocuments = useMemo(() => {
    const groups: Record<string, PolicyDocument[]> = {}
    filteredAndSortedDocuments.forEach(doc => {
      if (!groups[doc.category]) {
        groups[doc.category] = []
      }
      groups[doc.category].push(doc)
    })
    return groups
  }, [filteredAndSortedDocuments])

  const handleAddDocument = async () => {
    try {
      if (!formData.title || !formData.document_url) {
        toastError('Please fill in all required fields')
        return
      }

      const result = await authenticatedPost('/api/resource-hub', formData)

      if (result && result.success) {
        toastSuccess('Document added successfully')
        setIsAddModalOpen(false)
        resetForm()
        loadDocuments()
      } else {
        toastError(result?.error || 'Failed to add document')
      }
    } catch (error) {
      console.error('Error adding document:', error)
      toastError(error instanceof Error ? error.message : 'Failed to add document')
    }
  }

  const handleEditDocument = async () => {
    try {
      if (!editingDocument || !formData.title || !formData.document_url) {
        toastError('Please fill in all required fields')
        return
      }

      const result = await authenticatedPut(`/api/resource-hub/${editingDocument.id}`, formData)

      if (result && result.success) {
        toastSuccess('Document updated successfully')
        setIsEditModalOpen(false)
        setEditingDocument(null)
        resetForm()
        loadDocuments()
      } else {
        toastError(result?.error || 'Failed to update document')
      }
    } catch (error) {
      console.error('Error updating document:', error)
      toastError(error instanceof Error ? error.message : 'Failed to update document')
    }
  }

  // Selection handlers
  const handleSelectDocument = (documentId: string) => {
    const newSelected = new Set(selectedDocuments)
    if (newSelected.has(documentId)) {
      newSelected.delete(documentId)
    } else {
      newSelected.add(documentId)
    }
    setSelectedDocuments(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedDocuments.size === paginatedDocuments.length && paginatedDocuments.length > 0) {
      setSelectedDocuments(new Set())
    } else {
      setSelectedDocuments(new Set(paginatedDocuments.map(doc => doc.id)))
    }
  }

  // Delete handlers
  const handleDeleteDocument = (id: string) => {
    setDeletingDocumentId(id)
    setIsDeleteModalOpen(true)
  }

  const confirmDeleteDocument = async () => {
    if (!deletingDocumentId) return

    try {
      const success = await authenticatedDelete(`/api/resource-hub/${deletingDocumentId}`)

      if (success) {
        toastSuccess('Document deleted successfully')
        setIsDeleteModalOpen(false)
        setDeletingDocumentId(null)
        loadDocuments()
      } else {
        toastError('Failed to delete document')
      }
    } catch (error) {
      console.error('Error deleting document:', error)
      toastError(error instanceof Error ? error.message : 'Failed to delete document')
    }
  }

  const handleBulkDelete = () => {
    if (selectedDocuments.size === 0) {
      toastError('Please select documents to delete')
      return
    }
    setIsBulkDeleteModalOpen(true)
  }

  const confirmBulkDelete = async () => {
    try {
      setIsDeletingBulk(true)
      const deletePromises = Array.from(selectedDocuments).map(id =>
        authenticatedDelete(`/api/resource-hub/${id}`)
      )

      const results = await Promise.all(deletePromises)
      const successCount = results.filter(r => r).length

      if (successCount > 0) {
        toastSuccess(`Successfully deleted ${successCount} document${successCount !== 1 ? 's' : ''}`)
        setSelectedDocuments(new Set())
        setIsBulkDeleteModalOpen(false)
        loadDocuments()
      } else {
        toastError('Failed to delete documents')
      }
    } catch (error) {
      console.error('Error deleting documents:', error)
      toastError(error instanceof Error ? error.message : 'Failed to delete documents')
    } finally {
      setIsDeletingBulk(false)
    }
  }

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const formData = new FormData()
      formData.append('file', file)

      // Get authentication headers
      const headers: HeadersInit = {}

      // Get both Supabase session and position-based auth
      const { data: { session } } = await supabase.auth.getSession()
      const positionUser = await PositionAuthService.getCurrentUser()

      // Add position-based auth if available
      if (positionUser && positionUser.isAuthenticated) {
        headers['X-Position-Auth'] = 'true'
        headers['X-Position-User-Id'] = positionUser.id
        headers['X-Position-User-Role'] = positionUser.role
        headers['X-Position-Display-Name'] = positionUser.displayName
        headers['X-Position-Is-Super-Admin'] = positionUser.isSuperAdmin ? 'true' : 'false'
      }

      // Add Supabase auth if present
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`
      }

      const response = await fetch('/api/resource-hub/import', {
        method: 'POST',
        headers,
        body: formData
      })

      const result = await response.json()

      if (result.success) {
        const { imported, linksCreated, errors } = result.data
        let message = `Imported ${imported} document${imported !== 1 ? 's' : ''}`
        if (linksCreated && linksCreated > 0) {
          message += ` with ${linksCreated} task link${linksCreated !== 1 ? 's' : ''}`
        }
        toastSuccess(message)

        if (errors && errors.length > 0) {
          console.warn('Import warnings:', errors)
          // Show a warning toast for partial errors
          setTimeout(() => {
            toastError(`Import completed with ${errors.length} warning${errors.length !== 1 ? 's' : ''}. Check console for details.`)
          }, 2000)
        }
        loadDocuments()
      } else {
        toastError(result.error || 'Failed to import documents')
      }
    } catch (error) {
      console.error('Error importing documents:', error)
      toastError(error instanceof Error ? error.message : 'Failed to import documents')
    }

    // Reset file input
    event.target.value = ''
  }

  const openAddModal = () => {
    resetForm()
    setIsAddModalOpen(true)
    // Ensure master tasks are loaded when opening the modal
    if (isAdmin && masterTasks.length === 0) {
      console.log('🔍 Modal opened - Loading master tasks because array is empty')
      loadMasterTasks()
    }
  }

  const openEditModal = (doc: PolicyDocument) => {
    setEditingDocument(doc)
    setFormData({
      title: doc.title,
      document_url: doc.document_url,
      category: doc.category,
      document_type: doc.document_type,
      linked_tasks: doc.linked_tasks?.map((t: any) => t.id) || []
    })
    setIsEditModalOpen(true)
  }

  const resetForm = () => {
    setFormData({
      title: '',
      document_url: '',
      category: 'hr',
      document_type: 'general-policy',
      linked_tasks: []
    })
    setTaskSearchQuery('')
  }

  const toggleSort = (field: 'title' | 'category' | 'date') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('asc')
    }
  }

  // Group tasks by category for the dropdown
  const groupedTasks = useMemo(() => {
    console.log('🔍 Grouping tasks - masterTasks:', {
      count: masterTasks.length,
      taskSearchQuery,
      firstTask: masterTasks[0]
    })

    const filtered = masterTasks.filter(task => {
      // Check if task has description - if not, skip this task
      if (!task.description) {
        console.warn('⚠️ Task missing description, skipping:', { id: task.id, title: task.title })
        return false
      }

      // Filter by search query
      const searchLower = taskSearchQuery.toLowerCase()
      return task.description.toLowerCase().includes(searchLower)
    })

    console.log('🔍 Filtered tasks:', filtered.length)

    const grouped = filtered.reduce((acc, task) => {
      // Check if task has categories - if not, skip this task
      if (!task.categories || !Array.isArray(task.categories) || task.categories.length === 0) {
        console.warn('⚠️ Task missing categories array, skipping:', { id: task.id, title: task.title, description: task.description })
        return acc
      }

      task.categories.forEach(category => {
        if (!acc[category]) {
          acc[category] = []
        }
        // Avoid duplicates
        if (!acc[category].find(t => t.id === task.id)) {
          acc[category].push(task)
        }
      })
      return acc
    }, {} as Record<string, MasterTask[]>)

    console.log('✅ Grouped tasks:', {
      categoryCount: Object.keys(grouped).length,
      categories: Object.keys(grouped),
      taskCounts: Object.entries(grouped).map(([cat, tasks]) => ({ category: cat, count: tasks.length }))
    })

    return grouped
  }, [masterTasks, taskSearchQuery])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary)] mx-auto"></div>
          <p className="mt-2 text-[var(--color-text-secondary)]">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      {isAdmin ? <Navigation /> : <PublicNavigation onLoginClick={() => setIsLoginModalOpen(true)} />}

      <main className="max-w-content-lg mx-auto px-4 sm:px-6 lg:px-18 py-6 sm:py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="pharmacy-gradient rounded-lg p-4 sm:p-6 text-white">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold mb-2">
                  {isAdmin ? 'Resource Hub Management' : 'Resource Hub'}
                </h1>
                <p className="text-white/90 text-sm sm:text-base">
                  {isAdmin
                    ? 'Manage policy documents and task instructions'
                    : 'Access pharmacy policies, procedures, and instructions'}
                </p>
              </div>
              <div className="flex gap-2">
                {isAdmin ? (
                  <Button
                    onClick={openAddModal}
                    className="bg-white text-[var(--color-primary)] hover:bg-white/90"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Document
                  </Button>
                ) : (
                  <Button
                    onClick={() => router.push('/')}
                    variant="outline"
                    size="sm"
                    className="bg-white text-blue-600 hover:bg-gray-100 w-full sm:w-auto"
                  >
                    <Home className="w-4 h-4 mr-2" />
                    Back Home
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <Card className="card-surface mb-6">
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
              {/* Search */}
              <div className="md:col-span-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Search documents..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Category Filter */}
              <div className="flex justify-start w-full">
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {Object.entries(DOCUMENT_CATEGORY_CONFIG).map(([value, config]) => (
                      <SelectItem key={value} value={value}>
                        {config.emoji} {config.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Type Filter */}
              <div className="flex justify-start w-full">
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {Object.entries(DOCUMENT_TYPE_CONFIG).map(([value, config]) => (
                      <SelectItem key={value} value={value}>
                        {config.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {isAdmin && (
                <div className="flex justify-start w-full">
                  <input
                    id="import-file"
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleImport}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Import Excel
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Documents Table */}
        <Card className="card-surface w-full gap-0">
          <CardHeader className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
              <div className="flex flex-col sm:flex-row sm:items-center sm:gap-3">
                <CardTitle className="text-lg lg:text-xl mb-1">
                  Documents ({filteredAndSortedDocuments.length === 0 ? '0' : `${startIndex + 1}-${Math.min(endIndex, filteredAndSortedDocuments.length)}`} of {filteredAndSortedDocuments.length})
                  {totalPages > 1 && (
                    <span className="text-sm font-normal text-gray-600 ml-2">
                      - Page {currentPage} of {totalPages}
                    </span>
                  )}
                </CardTitle>
              </div>
              <div className="mt-2 sm:mt-0 sm:ml-4 flex items-center gap-2">
                <span className="text-sm text-gray-600">Per page:</span>
                <Select value={String(documentsPerPage)} onValueChange={(v) => { setDocumentsPerPage(parseInt(v, 10)); setCurrentPage(1); }}>
                  <SelectTrigger className="h-8 w-[110px]">
                    <SelectValue>
                      {documentsPerPage === 999999 ? 'View All' : documentsPerPage}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                    <SelectItem value="150">150</SelectItem>
                    <SelectItem value="999999">View All</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Bulk Actions */}
            {isAdmin && selectedDocuments.size > 0 && (
              <div className="flex space-x-3">
                <span className="text-sm font-medium text-gray-700 mt-1">
                  {selectedDocuments.size} document{selectedDocuments.size !== 1 ? 's' : ''} selected
                </span>
                <div className="flex space-x-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBulkDelete}
                    disabled={isDeletingBulk}
                    className="flex items-center space-x-1 text-red-600 hover:text-red-700 border-red-200 hover:border-red-300"
                  >
                    {isDeletingBulk ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                        <span>Deleting Selected...</span>
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4" />
                        <span>Delete Selected</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {filteredAndSortedDocuments.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No documents found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      {isAdmin && (
                        <TableHead className="w-[3%] py-4 text-center">
                          <Checkbox
                            checked={selectedDocuments.size === paginatedDocuments.length && paginatedDocuments.length > 0}
                            onCheckedChange={handleSelectAll}
                            className="data-[state=checked]:bg-blue-500 data-[state=checked]:text-white data-[state=checked]:border-blue-500"
                          />
                        </TableHead>
                      )}
                      <TableHead className="text-center w-[3%] py-4">New</TableHead>
                      <TableHead className={isAdmin ? "text-center w-[36%] py-4" : "text-center w-[38%] py-4"}>
                        <button
                          onClick={() => toggleSort('title')}
                          className="flex items-center gap-1 hover:text-[var(--color-primary)]"
                        >
                          Document Title
                          <ArrowUpDown className="w-4 h-4" />
                        </button>
                      </TableHead>
                      <TableHead className="text-center w-[7%] py-4">
                        <button
                          onClick={() => toggleSort('category')}
                          className="flex items-center gap-1 hover:text-[var(--color-primary)] mx-auto"
                        >
                          Category
                          <ArrowUpDown className="w-4 h-4" />
                        </button>
                      </TableHead>
                      <TableHead className="text-center w-[7%] py-4">Type</TableHead>
                      <TableHead className={isAdmin ? "text-center w-[37%] py-4" : "text-center w-[40%] py-4"}>Linked Tasks</TableHead>
                      <TableHead className={isAdmin ? "text-center w-[7%] py-4" : "text-center w-[5%] py-4"}>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedDocuments.map((doc) => (
                      <TableRow key={doc.id} className="hover:bg-gray-50">
                        {isAdmin && (
                          <TableCell className="py-4 text-center">
                            <Checkbox
                              checked={selectedDocuments.has(doc.id)}
                              onCheckedChange={() => handleSelectDocument(doc.id)}
                              className="data-[state=checked]:bg-blue-500 data-[state=checked]:text-white data-[state=checked]:border-blue-500"
                            />
                          </TableCell>
                        )}
                        <TableCell className="py-4 text-center">
                          {doc.is_new ? (
                            <span title="New document (created within 12 hours)" className="relative inline-flex">
                              <span className="absolute inline-flex h-5 w-5 rounded-full bg-blue-400 animate-ping"></span>
                              <span className="relative inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold">N</span>
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell className="font-medium">
                          <span>{doc.title}</span>
                        </TableCell>
                        <TableCell className="py-4 text-center">
                          <Badge className={DOCUMENT_CATEGORY_CONFIG[doc.category]?.color || 'bg-gray-100'}>
                            {DOCUMENT_CATEGORY_CONFIG[doc.category]?.emoji} {DOCUMENT_CATEGORY_CONFIG[doc.category]?.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-4 text-center">
                          <Badge className={DOCUMENT_TYPE_CONFIG[doc.document_type]?.color || 'bg-gray-100'}>
                            {DOCUMENT_TYPE_CONFIG[doc.document_type]?.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-1 text-left max-w-0">
                          {doc.linked_tasks && doc.linked_tasks.length > 0 ? (
                            <div className="flex flex-col gap-1 w-full">
                              {doc.linked_tasks.map((task: any) => {
                                const taskText = task.description || task.title
                                return (
                                  <span
                                    key={task.id}
                                    className="text-sm text-gray-600 truncate block cursor-help"
                                    title={taskText}
                                  >
                                    • {taskText}
                                  </span>
                                )
                              })}
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400"></span>
                          )}
                        </TableCell>
                        <TableCell className="text-center py-1">
                          <div className="text-center max-w-full space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="hover:bg-cyan-200 text-cyan-600 h-8 w-7 p-0"
                              onClick={() => window.open(doc.document_url, '_blank')}
                            >
                              <BookOpen className="w-4 h-4" />
                            </Button>
                            {isAdmin && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-blue-600 h-8 w-7 p-0"
                                  onClick={() => openEditModal(doc)}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-blue-600 h-8 w-7 p-0"
                                  onClick={() => handleDeleteDocument(doc.id)}
                                >
                                  <Trash2 className="w-4 h-4 text-red-600" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Pagination */}
                {filteredAndSortedDocuments.length > 0 && (
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                  />
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Add/Edit Modal */}
      <Dialog open={isAddModalOpen || isEditModalOpen} onOpenChange={(open) => {
        if (!open) {
          setIsAddModalOpen(false)
          setIsEditModalOpen(false)
          setEditingDocument(null)
          resetForm()
        }
      }}>
        <DialogContent className="!flex !flex-col !gap-0 !p-0" style={{ maxWidth: "60rem", width: "45vw", maxHeight: "70vh" }}>
          <DialogHeader className="px-8 pt-10 pb-4">
            <DialogTitle className="text-xl font-semibold">
              {isEditModalOpen ? 'Edit Document' : 'Add Policy Document'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 px-8 py-4 overflow-y-auto flex-1 min-h-0">
            <div className="space-y-2">
              <Label htmlFor="title">Document Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Enter document title"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="document_url">Document Link *</Label>
              <Input
                id="document_url"
                value={formData.document_url}
                onChange={(e) => setFormData({ ...formData, document_url: e.target.value })}
                placeholder="https://docs.google.com/..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(DOCUMENT_CATEGORY_CONFIG).map(([value, config]) => (
                      <SelectItem key={value} value={value}>
                        {config.emoji} {config.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="document_type">Type *</Label>
                <div className="flex items-center h-9 px-3 py-2 border border-gray-200 rounded-md bg-gray-50">
                  <span className="text-sm text-gray-700">
                    {formData.linked_tasks.length > 0 ? 'Task Instruction' : 'General Policy'}
                  </span>
                </div>
              </div>
            </div>

            {isAdmin && (

              <div className="space-y-2">
                <Label>Link Tasks</Label>
                <div className="grid grid-cols-2 gap-4">
                  <Popover onOpenChange={(open) => {
                    if (open) {
                      console.log('🔍 Popover opened - Current state:', {
                        masterTasksCount: masterTasks.length,
                        groupedTasksKeys: Object.keys(groupedTasks),
                        groupedTasksCount: Object.keys(groupedTasks).length,
                        taskSearchQuery
                      })
                    }
                  }}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-between"
                        type="button"
                      >
                        <span className="text-sm text-gray-600">
                          {formData.linked_tasks.length > 0
                            ? `${formData.linked_tasks.length} task${formData.linked_tasks.length !== 1 ? 's' : ''} selected`
                            : 'Select tasks to link'}
                        </span>
                        <ChevronDown className="h-4 w-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[500px] p-0" align="start">
                      <div className="p-3 border-b">
                        <Input
                          placeholder="Search tasks by description..."
                          value={taskSearchQuery}
                          onChange={(e) => setTaskSearchQuery(e.target.value)}
                          className="h-9"
                        />
                      </div>
                      <div
                        className="max-h-[300px] overflow-y-auto p-2 overscroll-contain"
                        style={{ overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}
                        onWheel={(e) => e.stopPropagation()}
                      >
                        {Object.keys(groupedTasks).length === 0 ? (
                          <div className="text-center py-6 text-sm text-gray-500">
                            No tasks found
                          </div>
                        ) : (
                          Object.entries(groupedTasks).map(([category, tasks]) => (
                            <div key={category} className="mb-3">
                              <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50 rounded">
                                {TASK_CATEGORY_CONFIG[category]?.emoji} {TASK_CATEGORY_CONFIG[category]?.label || category}
                              </div>
                              <div className="mt-1 space-y-1">
                                {tasks.map((task) => (
                                  <div
                                    key={task.id}
                                    className="flex items-start gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                                    onClick={() => {
                                      const isSelected = formData.linked_tasks.includes(task.id)
                                      setFormData({
                                        ...formData,
                                        linked_tasks: isSelected
                                          ? formData.linked_tasks.filter(id => id !== task.id)
                                          : [...formData.linked_tasks, task.id]
                                      })
                                    }}
                                  >
                                    <Checkbox
                                      checked={formData.linked_tasks.includes(task.id)}
                                      className="mt-0.5 data-[state=checked]:bg-blue-500 data-[state=checked]:border-primary [&>span]:data-[state=checked]:text-white"
                                      readOnly
                                    />
                                    <span
                                      className="text-sm flex-1 line-clamp-2"
                                      title={task.description}
                                    >
                                      {task.description}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                {/* Selected tasks badges */}
                {formData.linked_tasks.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2 p-2 border rounded-md bg-gray-50">
                    {formData.linked_tasks.map((taskId) => {
                      const task = masterTasks.find(t => t.id === taskId)
                      if (!task) return null
                      return (
                        <Badge
                          key={taskId}
                          variant="secondary"
                          className="flex items-center gap-1 px-2 py-1"
                        >
                          <span className="text-xs truncate max-w-[200px]" title={task.description}>
                            {task.description}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setFormData({
                                ...formData,
                                linked_tasks: formData.linked_tasks.filter(id => id !== taskId)
                              })
                            }}
                            className="ml-1 hover:bg-gray-300 rounded-full p-0.5"
                          >
                            <XIcon className="h-3 w-3" />
                          </button>
                        </Badge>
                      )
                    })}
                  </div>
                )}

              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 px-8 py-6 border-t">
            <Button
              variant="outline"
              onClick={() => {
                setIsAddModalOpen(false)
                setIsEditModalOpen(false)
                setEditingDocument(null)
                resetForm()
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={isEditModalOpen ? handleEditDocument : handleAddDocument}
              className="bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 text-[var(--color-primary-on)]"
            >
              {isEditModalOpen ? 'Update' : 'Add'} Document
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete Document</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-gray-600">
              Are you sure you want to delete this document? This action cannot be undone.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsDeleteModalOpen(false)
                setDeletingDocumentId(null)
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeleteDocument}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirmation Modal */}
      <Dialog open={isBulkDeleteModalOpen} onOpenChange={setIsBulkDeleteModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete Multiple Documents</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-gray-600">
              Are you sure you want to delete {selectedDocuments.size} document{selectedDocuments.size !== 1 ? 's' : ''}?
              This action cannot be undone.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setIsBulkDeleteModalOpen(false)}
              disabled={isDeletingBulk}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmBulkDelete}
              disabled={isDeletingBulk}
            >
              {isDeletingBulk ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Deleting...
                </>
              ) : (
                'Delete All'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Login Modal */}
      <PositionLoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        modalType="general"
      />
    </div>
  )
}