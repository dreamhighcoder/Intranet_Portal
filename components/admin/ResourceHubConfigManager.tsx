'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Plus, Edit2, Trash2, BookOpen } from 'lucide-react'
import { toastError } from '@/hooks/use-toast'
import { authenticatedGet } from '@/lib/api-client'
import { Settings } from "lucide-react"

// Utility function to generate ID from label
const generateIdFromLabel = (label: string): string => {
  return label
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
}
interface Category {
  id: string
  label: string
  emoji: string
  color: string
}

interface DocumentType {
  id: string
  label: string
  color: string
}

export interface ResourceHubConfigRef {
  getState: () => { categories: Category[]; documentTypes: DocumentType[] }
}

interface ResourceHubConfigManagerProps {
  categories?: Category[]
  documentTypes?: DocumentType[]
  onCategoriesChange?: (categories: Category[]) => void
  onDocumentTypesChange?: (types: DocumentType[]) => void
}

export function ResourceHubConfigManager(props: ResourceHubConfigManagerProps) {
  const [categories, setCategories] = useState<Category[]>(props.categories || [])
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>(props.documentTypes || [])
  const [loading, setLoading] = useState(true)

  // Dialog states
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false)
  const [isTypeDialogOpen, setIsTypeDialogOpen] = useState(false)
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null)

  // Form states
  const [categoryForm, setCategoryForm] = useState({
    id: '',
    label: '',
    emoji: '',
    color: ''
  })

  const [typeForm, setTypeForm] = useState({
    id: '',
    label: '',
    color: ''
  })

  // Color options for dropdowns
  const categoryColorOptions = [
    { value: 'bg-purple-100 text-purple-800 border-purple-200', label: 'Light Purple' },
    { value: 'bg-blue-100 text-blue-800 border-blue-200', label: 'Light Blue' },
    { value: 'bg-green-100 text-green-800 border-green-200', label: 'Light Green' },
    { value: 'bg-red-100 text-red-800 border-red-200', label: 'Light Red' },
    { value: 'bg-yellow-100 text-yellow-800 border-yellow-200', label: 'Light Yellow' },
    { value: 'bg-gray-100 text-gray-800 border-gray-200', label: 'Light Gray' }
  ]

  const typeColorOptions = [
    { value: 'bg-blue-50 text-blue-700 border-blue-200', label: 'Light Blue' },
    { value: 'bg-green-50 text-green-700 border-green-200', label: 'Light Green' },
    { value: 'bg-red-50 text-red-700 border-red-200', label: 'Light Red' },
    { value: 'bg-purple-50 text-purple-700 border-purple-200', label: 'Light Purple' },
    { value: 'bg-yellow-50 text-yellow-700 border-yellow-200', label: 'Light Yellow' },
    { value: 'bg-gray-50 text-gray-700 border-gray-200', label: 'Light Gray' }
  ]

  // Load configuration only if not controlled by parent
  useEffect(() => {
    // If parent provides props, don't load from API
    const isControlled = props.categories !== undefined || props.documentTypes !== undefined

    if (isControlled) {
      // Sync internal state with parent props in controlled mode
      if (props.categories !== undefined) {
        setCategories(props.categories)
      }
      if (props.documentTypes !== undefined) {
        setDocumentTypes(props.documentTypes)
      }
      setLoading(false)
    } else {
      // Load from API if not controlled by parent
      loadConfig()
    }
  }, [props.categories, props.documentTypes])

  const loadConfig = async () => {
    try {
      setLoading(true)
      const result = await authenticatedGet('/api/admin/resource-hub-config')

      console.log('Resource Hub Config Response:', result)

      if (result && result.success && result.data) {
        const cats = Array.isArray(result.data.categories) ? result.data.categories : []
        const types = Array.isArray(result.data.documentTypes) ? result.data.documentTypes : []
        console.log('Setting categories:', cats)
        console.log('Setting documentTypes:', types)
        setCategories(cats)
        setDocumentTypes(types)
      } else {
        console.warn('Invalid response format or failed response:', result)
        // Initialize with empty arrays if API fails
        setCategories([])
        setDocumentTypes([])
        if (result?.error) {
          toastError(result.error)
        }
      }
    } catch (error) {
      console.error('Error loading config:', error)
      // Initialize with empty arrays on error
      setCategories([])
      setDocumentTypes([])
      toastError(error instanceof Error ? error.message : 'Failed to load configuration')
    } finally {
      setLoading(false)
    }
  }



  // Category handlers
  const openAddCategoryDialog = () => {
    setEditingCategoryId(null)
    setCategoryForm({ id: '', label: '', emoji: '', color: '' })
    setIsCategoryDialogOpen(true)
  }

  const openEditCategoryDialog = (cat: Category) => {
    setEditingCategoryId(cat.id)
    // Ensure all fields are preserved when editing
    const formData = {
      id: cat.id || '',
      label: cat.label || '',
      emoji: cat.emoji || '',
      color: cat.color || ''
    }
    setCategoryForm(formData)
    console.log('📝 Opened edit dialog for category:', { 
      original: cat,
      formData: formData,
      hasAllFields: !!(cat.id && cat.label && cat.emoji && cat.color)
    })
    setIsCategoryDialogOpen(true)
  }

  const saveCategoryDialog = () => {
    // Normalize form data to ensure all fields are strings (not undefined)
    const normalizedForm = {
      label: (categoryForm.label || '').trim(),
      emoji: (categoryForm.emoji || '').trim(),
      color: (categoryForm.color || '').trim()
    }

    if (!normalizedForm.label || !normalizedForm.emoji || !normalizedForm.color) {
      toastError('Please fill in all fields: Label, Emoji, and Color')
      return
    }

    let categoryId: string
    
    if (editingCategoryId) {
      // When editing, keep the existing ID to maintain document references
      categoryId = editingCategoryId
      console.log('📝 Editing category - keeping existing ID:', categoryId)
    } else {
      // When adding new, generate ID from label
      categoryId = generateIdFromLabel(normalizedForm.label)
      
      if (!categoryId) {
        toastError('Label must contain at least one alphanumeric character')
        return
      }

      // Check for duplicates only when adding new
      const isDuplicate = categories.some(cat => cat.id === categoryId)
      if (isDuplicate) {
        toastError(`A category with the label "${normalizedForm.label}" already exists. Please use a different label.`)
        return
      }
    }

    // Ensure all required fields are present in the saved object
    const categoryWithId: Category = {
      id: categoryId,
      label: normalizedForm.label,
      emoji: normalizedForm.emoji,
      color: normalizedForm.color
    }

    console.log('📝 saveCategoryDialog - Saving category:', JSON.stringify(categoryWithId, null, 2))

    let newCategories: Category[]
    if (editingCategoryId) {
      newCategories = categories.map(cat => cat.id === editingCategoryId ? categoryWithId : cat)
      console.log('📝 Updated category in array at index:', categories.findIndex(cat => cat.id === editingCategoryId))
    } else {
      newCategories = [...categories, categoryWithId]
      console.log('📝 Added new category. Total categories:', newCategories.length)
    }

    console.log('📝 saveCategoryDialog - All categories after save:', JSON.stringify(newCategories, null, 2))
    console.log('📝 saveCategoryDialog - onCategoriesChange callback defined:', !!props.onCategoriesChange)

    setCategories(newCategories)
    if (props.onCategoriesChange) {
      console.log('✅ Calling onCategoriesChange callback with categories:', newCategories.length, 'items')
      props.onCategoriesChange(newCategories)
    } else {
      console.warn('⚠️ onCategoriesChange callback not defined!')
    }

    setIsCategoryDialogOpen(false)
    setCategoryForm({ id: '', label: '', emoji: '', color: '' })
  }

  const deleteCategory = (id: string) => {
    const newCategories = categories.filter(cat => cat.id !== id)
    console.log('📝 deleteCategory - Deleting category:', id, '- New categories:', newCategories)
    setCategories(newCategories)
    props.onCategoriesChange?.(newCategories)
  }

  // Document Type handlers
  const openAddTypeDialog = () => {
    setEditingTypeId(null)
    setTypeForm({ id: '', label: '', color: '' })
    setIsTypeDialogOpen(true)
  }

  const openEditTypeDialog = (type: DocumentType) => {
    setEditingTypeId(type.id)
    // Ensure all fields are preserved when editing
    const formData = {
      id: type.id || '',
      label: type.label || '',
      color: type.color || ''
    }
    setTypeForm(formData)
    console.log('📝 Opened edit dialog for document type:', { 
      original: type,
      formData: formData,
      hasAllFields: !!(type.id && type.label && type.color)
    })
    setIsTypeDialogOpen(true)
  }

  const saveTypeDialog = () => {
    // Normalize form data to ensure all fields are strings (not undefined)
    const normalizedForm = {
      label: (typeForm.label || '').trim(),
      color: (typeForm.color || '').trim()
    }

    if (!normalizedForm.label || !normalizedForm.color) {
      toastError('Please fill in all fields: Label and Color')
      return
    }

    let typeId: string
    
    if (editingTypeId) {
      // When editing, keep the existing ID to maintain document references
      typeId = editingTypeId
      console.log('📝 Editing type - keeping existing ID:', typeId)
    } else {
      // When adding new, generate ID from label
      typeId = generateIdFromLabel(normalizedForm.label)
      
      if (!typeId) {
        toastError('Label must contain at least one alphanumeric character')
        return
      }

      // Check for duplicates only when adding new
      const isDuplicate = documentTypes.some(t => t.id === typeId)
      if (isDuplicate) {
        toastError(`A document type with the label "${normalizedForm.label}" already exists. Please use a different label.`)
        return
      }
    }

    // Ensure all required fields are present in the saved object
    const typeWithId: DocumentType = {
      id: typeId,
      label: normalizedForm.label,
      color: normalizedForm.color
    }

    console.log('📝 saveTypeDialog - Saving document type:', JSON.stringify(typeWithId, null, 2))

    let newTypes: DocumentType[]
    if (editingTypeId) {
      newTypes = documentTypes.map(t => t.id === editingTypeId ? typeWithId : t)
      console.log('📝 Updated type in array at index:', documentTypes.findIndex(t => t.id === editingTypeId))
    } else {
      newTypes = [...documentTypes, typeWithId]
      console.log('📝 Added new type. Total types:', newTypes.length)
    }

    console.log('📝 saveTypeDialog - All types after save:', JSON.stringify(newTypes, null, 2))
    console.log('📝 saveTypeDialog - onDocumentTypesChange callback defined:', !!props.onDocumentTypesChange)

    setDocumentTypes(newTypes)
    if (props.onDocumentTypesChange) {
      console.log('✅ Calling onDocumentTypesChange callback with types:', newTypes.length, 'items')
      props.onDocumentTypesChange(newTypes)
    } else {
      console.warn('⚠️ onDocumentTypesChange callback not defined!')
    }

    setIsTypeDialogOpen(false)
    setTypeForm({ id: '', label: '', color: '' })
  }

  const deleteType = (id: string) => {
    const newTypes = documentTypes.filter(t => t.id !== id)
    console.log('📝 deleteType - Deleting type:', id, '- New types:', newTypes)
    setDocumentTypes(newTypes)
    props.onDocumentTypesChange?.(newTypes)
  }

  // Ensure documentTypes is always an array
  const safeDocumentTypes = Array.isArray(documentTypes) ? documentTypes : []
  const safeCategories = Array.isArray(categories) ? categories : []

  if (loading) {
    return <div className="text-center py-6">Loading...</div>
  }

  return (

    <Card className="card-surface gap-3 sm:px-6 sm:py-4 mb-6">
      <CardHeader className="px-0 pt-2">
        <div className="flex items-center space-x-2">
          <Settings className="w-5 h-5 text-[var(--color-primary)]" />
          <CardTitle className="text-base sm:text-lg">Resource Hub Configuration</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="px-0 grid grid-cols-1 lg:grid-cols-2 gap-4 text-sm">
        {/* Categories Section */}
        <Card className="px-0 rounded-md border shadow-sm gap-3">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CardTitle className="text-base font-medium mb-2">Resource Hub Document Categories</CardTitle>
              </div>
              <Button
                size="sm"
                onClick={openAddCategoryDialog}
                className="bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/80 text-white"
              >
                <Plus className="w-4 h-4" />
                Add Category
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-[var(--color-text-secondary)]">
            {safeCategories.length === 0 ? (
              <p className="text-sm text-[var(--color-text-muted)]">No categories configured</p>
            ) : (
              <div className="space-y-2">
                {safeCategories.map((cat) => (
                  <div key={cat.id} className="flex items-center justify-between px-3 py-1 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <span className="text-lg">{cat.emoji}</span>
                      <div>
                        <p className="font-medium text-sm">{cat.label}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge className={cat.color}>{cat.label}</Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditCategoryDialog(cat)}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteCategory(cat.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        {/* Document Types Section */}
        <Card className="px-0 rounded-md border shadow-sm gap-3">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CardTitle className="text-base font-medium mb-2">Resource Hub Document Types</CardTitle>
              </div>
              <Button
                size="sm"
                onClick={openAddTypeDialog}
                className="bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/80 text-white"
              >
                <Plus className="w-4 h-4" />
                Add Type
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-[var(--color-text-secondary)]">
            {safeDocumentTypes.length === 0 ? (
              <p className="text-sm text-[var(--color-text-muted)]">No document types configured</p>
            ) : (
              <div className="space-y-2">
                {safeDocumentTypes.map((type) => (
                  <div key={type.id} className="flex items-center justify-between px-3 py-1 border rounded-lg">
                    <div>
                      <p className="font-medium text-sm">{type.label}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge className={type.color}>{type.label}</Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditTypeDialog(type)}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteType(type.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </CardContent>

      {/* Category Dialog */}
      <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCategoryId ? 'Edit Category' : 'Add Category'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cat-label">Label</Label>
              <Input
                id="cat-label"
                value={categoryForm.label}
                onChange={(e) => setCategoryForm({ ...categoryForm, label: e.target.value })}
                placeholder="e.g., Human Resources"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-emoji">Emoji</Label>
              <Input
                id="cat-emoji"
                value={categoryForm.emoji}
                onChange={(e) => setCategoryForm({ ...categoryForm, emoji: e.target.value })}
                placeholder="e.g., 👥"
                maxLength={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-color">Badge Color</Label>
              <select
                id="cat-color"
                value={categoryForm.color}
                onChange={(e) => setCategoryForm({ ...categoryForm, color: e.target.value })}
                className="w-full px-3 py-2 border rounded-md"
              >
                <option value="">Select a color</option>
                {categoryColorOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCategoryDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={saveCategoryDialog}
              className="bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 text-white"
            >
              {editingCategoryId ? 'Update' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Document Type Dialog */}
      <Dialog open={isTypeDialogOpen} onOpenChange={setIsTypeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingTypeId ? 'Edit Document Type' : 'Add Document Type'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="type-label">Label</Label>
              <Input
                id="type-label"
                value={typeForm.label}
                onChange={(e) => setTypeForm({ ...typeForm, label: e.target.value })}
                placeholder="e.g., General Policy"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type-color">Badge Color</Label>
              <select
                id="type-color"
                value={typeForm.color}
                onChange={(e) => setTypeForm({ ...typeForm, color: e.target.value })}
                className="w-full px-3 py-2 border rounded-md"
              >
                <option value="">Select a color</option>
                {typeColorOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTypeDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={saveTypeDialog}
              className="bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 text-white"
            >
              {editingTypeId ? 'Update' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}