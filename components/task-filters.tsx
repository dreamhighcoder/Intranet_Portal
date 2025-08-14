"use client"

import { useState, useEffect } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { TASK_CATEGORIES } from "@/lib/constants"
import { Position } from "@/lib/types"
import { positionsApi } from "@/lib/api-client"
import { toastError } from "@/hooks/use-toast"
import { useAuth } from "@/lib/auth"

interface TaskFiltersProps {
  selectedPosition: string
  selectedCategory: string
  selectedStatus: string
  onPositionChange: (position: string) => void
  onCategoryChange: (category: string) => void
  onStatusChange: (status: string) => void
  hidePositionFilter?: boolean // Added prop to hide position filter for regular users
}

export function TaskFilters({
  selectedPosition,
  selectedCategory,
  selectedStatus,
  onPositionChange,
  onCategoryChange,
  onStatusChange,
  hidePositionFilter = false, // Default to false for backward compatibility
}: TaskFiltersProps) {
  const [positions, setPositions] = useState<Position[]>([])
  const [isLoadingPositions, setIsLoadingPositions] = useState(true)
  const { user, isLoading } = useAuth()

  useEffect(() => {
    async function fetchPositions() {
      if (hidePositionFilter || isLoading || !user) {
        setIsLoadingPositions(false)
        return
      }
      
      try {
        const data = await positionsApi.getAll()
        if (data) {
          setPositions(data)
        }
      } catch (error) {
        console.error('Error fetching positions:', error)
        toastError("Error", "Failed to load positions for filtering")
      } finally {
        setIsLoadingPositions(false)
      }
    }

    fetchPositions()
  }, [hidePositionFilter, user, isLoading])

  const statusOptions = [
    { value: "all", label: "All Status" },
    { value: "not_due", label: "Not Due" },
    { value: "due_today", label: "Due Today" },
    { value: "overdue", label: "Overdue" },
    { value: "missed", label: "Missed" },
    { value: "done", label: "Done" },
  ]

  return (
    <div className="flex flex-wrap items-center gap-4 p-4 bg-white rounded-lg border border-[var(--color-border)]">
      <div className="flex items-center space-x-2">
        <span className="text-sm font-medium text-[var(--color-text-secondary)]">Filters:</span>
      </div>

      {!hidePositionFilter && (
        <Select value={selectedPosition} onValueChange={onPositionChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={isLoadingPositions ? "Loading..." : "All Positions"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Positions</SelectItem>
            {positions.map((position) => (
              <SelectItem key={position.id} value={position.id}>
                {position.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <Select value={selectedCategory} onValueChange={onCategoryChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="All Categories" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Categories</SelectItem>
          {TASK_CATEGORIES.map((category) => (
            <SelectItem key={category} value={category}>
              {category}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={selectedStatus} onValueChange={onStatusChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="All Status" />
        </SelectTrigger>
        <SelectContent>
          {statusOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {((!hidePositionFilter && selectedPosition !== "all") ||
        selectedCategory !== "all" ||
        selectedStatus !== "all") && (
        <Badge variant="secondary" className="ml-2">
          Filters Active
        </Badge>
      )}
    </div>
  )
}
