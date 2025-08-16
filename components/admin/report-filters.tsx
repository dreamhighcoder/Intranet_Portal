"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon, Download } from "lucide-react"
import { TASK_CATEGORIES } from "@/lib/constants"
import { Position } from "@/lib/types"
import { positionsApi } from "@/lib/api-client"
import { useAuth } from "@/lib/auth"

interface ReportFiltersProps {
  onFiltersChange: (filters: any) => void
  onExport: (format: "csv" | "excel") => void
}

export function ReportFilters({ onFiltersChange, onExport }: ReportFiltersProps) {
  const [positions, setPositions] = useState<Position[]>([])
  const [isLoadingPositions, setIsLoadingPositions] = useState(true)
  const { user, isLoading } = useAuth()
  const [dateRange, setDateRange] = useState({
    from: new Date(new Date().setDate(new Date().getDate() - 30)),
    to: new Date(),
  })
  const [selectedPositions, setSelectedPositions] = useState<string[]>([])
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [selectedStatus, setSelectedStatus] = useState("all")

  useEffect(() => {
    async function fetchPositions() {
      if (isLoading || !user) {
        setIsLoadingPositions(false)
        return
      }
      
      try {
        const data = await positionsApi.getAll()
        if (data) {
          // Filter out administrator positions from the dropdown
          const filteredPositions = data.filter((position: any) => {
            const isAdmin = position.role === 'admin' || 
                           position.name.toLowerCase().includes('admin') || 
                           position.displayName?.toLowerCase().includes('admin')
            return !isAdmin
          })
          setPositions(filteredPositions)
        }
      } catch (error) {
        console.error('Error fetching positions:', error)
      } finally {
        setIsLoadingPositions(false)
      }
    }

    fetchPositions()
  }, [user, isLoading])

  const handleApplyFilters = () => {
    onFiltersChange({
      dateRange,
      positions: selectedPositions,
      categories: selectedCategories,
      status: selectedStatus,
    })
  }

  return (
    <Card className="card-surface">
      <CardHeader>
        <CardTitle>Report Filters</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Date Range */}
          <div className="space-y-2">
            <Label>Date Range</Label>
            <div className="flex space-x-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="flex items-center space-x-2 bg-transparent">
                    <CalendarIcon className="w-4 h-4" />
                    <span>{dateRange.from.toLocaleDateString("en-AU")}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateRange.from}
                    onSelect={(date) => date && setDateRange((prev) => ({ ...prev, from: date }))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <span className="self-center text-[var(--color-text-secondary)]">to</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="flex items-center space-x-2 bg-transparent">
                    <CalendarIcon className="w-4 h-4" />
                    <span>{dateRange.to.toLocaleDateString("en-AU")}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateRange.to}
                    onSelect={(date) => date && setDateRange((prev) => ({ ...prev, to: date }))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Status Filter */}
          <div className="space-y-2">
            <Label>Task Status</Label>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger>
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="done">Completed</SelectItem>
                <SelectItem value="missed">Missed</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="due_today">Due Today</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Position Filter */}
          <div className="space-y-2">
            <Label>Positions</Label>
            <Select
              value={selectedPositions.length > 0 ? selectedPositions[0] : "all"}
              onValueChange={(value) => setSelectedPositions(value === "all" ? [] : [value])}
            >
              <SelectTrigger>
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
          </div>

          {/* Category Filter */}
          <div className="space-y-2">
            <Label>Categories</Label>
            <Select
              value={selectedCategories.length > 0 ? selectedCategories[0] : "all"}
              onValueChange={(value) => setSelectedCategories(value === "all" ? [] : [value])}
            >
              <SelectTrigger>
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
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
          <Button onClick={handleApplyFilters} className="bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 text-[var(--color-primary-on)]">
            Apply Filters
          </Button>

          <div className="flex items-center space-x-2">
            <Button variant="outline" onClick={() => onExport("csv")} className="bg-transparent">
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
            <Button variant="outline" onClick={() => onExport("excel")} className="bg-transparent">
              <Download className="w-4 h-4 mr-2" />
              Export Excel
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
