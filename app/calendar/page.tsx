"use client"

import { useState, useEffect } from "react"
import { usePositionAuth } from "@/lib/position-auth-context"
import { Navigation } from "@/components/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { authenticatedGet, positionsApi } from "@/lib/api-client"
import { toastError } from "@/hooks/use-toast"
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon,
  CheckCircle,
  Clock,
  AlertTriangle,
  XCircle,
  Users
} from "lucide-react"
import { useRouter } from "next/navigation"

interface CalendarDay {
  date: string
  total: number
  completed: number
  pending: number
  overdue: number
  missed: number
  holiday?: string
  tasks: Array<{
    id: string
    title: string
    category?: string
    position: string
    status: string
  }>
}

interface CalendarData {
  calendar: CalendarDay[]
  summary: {
    totalTasks: number
    completedTasks: number
    pendingTasks: number
    overdueTasks: number
    missedTasks: number
    completionRate: number
  }
  metadata: {
    view: string
    year: number
    month: number
    startDate: string
    endDate: string
    positionId?: string
    totalDays: number
    daysWithTasks: number
  }
}

interface Position {
  id: string
  name: string
}

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
]

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

export default function CalendarPage() {
  const { user, isLoading: authLoading, isAdmin } = usePositionAuth()
  const router = useRouter()
  
  const [calendarData, setCalendarData] = useState<CalendarData | null>(null)
  const [positions, setPositions] = useState<Position[]>([])
  const [loading, setLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedPosition, setSelectedPosition] = useState<string>("all")
  const [view, setView] = useState<"month" | "week">("month")

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/")
    }
  }, [user, authLoading, router])

  useEffect(() => {
    if (!authLoading && user) {
      loadPositions()
      loadCalendarData()
    }
  }, [authLoading, user, currentDate, selectedPosition, view])

  const loadPositions = async () => {
    if (!isAdmin) return
    
    try {
      const positionsData = await positionsApi.getAll()
      // Filter out administrator positions
      const filteredPositions = positionsData.filter(position => {
        const isAdminPosition = position.role === 'admin' || 
                               position.name.toLowerCase().includes('admin') || 
                               position.displayName?.toLowerCase().includes('admin')
        return !isAdminPosition
      })
      setPositions(filteredPositions)
    } catch (error) {
      console.error('Error loading positions:', error)
    }
  }

  const loadCalendarData = async () => {
    setLoading(true)
    try {
      const year = currentDate.getFullYear()
      const month = currentDate.getMonth() + 1
      
      const params = new URLSearchParams({
        year: year.toString(),
        month: month.toString(),
        view
      })
      
      if (selectedPosition !== "all") {
        params.append('position_id', selectedPosition)
      }
      
      if (view === "week") {
        params.append('date', currentDate.toISOString().split('T')[0])
      }

      const data = await authenticatedGet(`/api/calendar?${params.toString()}`)
      setCalendarData(data)
    } catch (error) {
      console.error('Error loading calendar data:', error)
      toastError("Error", "Failed to load calendar data")
    } finally {
      setLoading(false)
    }
  }

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate)
    if (direction === 'prev') {
      newDate.setMonth(newDate.getMonth() - 1)
    } else {
      newDate.setMonth(newDate.getMonth() + 1)
    }
    setCurrentDate(newDate)
  }

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate)
    if (direction === 'prev') {
      newDate.setDate(newDate.getDate() - 7)
    } else {
      newDate.setDate(newDate.getDate() + 7)
    }
    setCurrentDate(newDate)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'done':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'overdue':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'missed':
        return 'bg-gray-100 text-gray-800 border-gray-200'
      default:
        return 'bg-blue-100 text-blue-800 border-blue-200'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'done':
        return <CheckCircle className="w-3 h-3" />
      case 'overdue':
        return <AlertTriangle className="w-3 h-3" />
      case 'missed':
        return <XCircle className="w-3 h-3" />
      default:
        return <Clock className="w-3 h-3" />
    }
  }

  const handleDayClick = (date: string) => {
    // Navigate to the checklist page for the selected date
    // If user has a specific position, navigate to their checklist
    // Otherwise, navigate to a default role (pharmacist-in-charge)
    let targetRole = 'pharmacist-in-charge' // default role
    
    if (user?.position?.name) {
      // Convert position name to kebab-case for URL
      targetRole = user.position.name
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
    }
    
    router.push(`/checklist/${targetRole}?date=${date}`)
  }

  const renderCalendarGrid = () => {
    if (!calendarData) return null

    const { calendar } = calendarData
    const today = new Date().toISOString().split('T')[0]

    if (view === "week") {
      return (
        <div className="grid grid-cols-7 gap-1">
          {dayNames.map(day => (
            <div key={day} className="p-2 text-center font-medium text-gray-600 bg-gray-50">
              {day}
            </div>
          ))}
          {calendar.map((day, index) => {
            const date = new Date(day.date)
            const isToday = day.date === today
            
            return (
              <div
                key={day.date}
                onClick={() => handleDayClick(day.date)}
                className={`min-h-32 p-2 border border-gray-200 cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-[1.02] hover:border-blue-300 ${
                  isToday ? 'bg-blue-50 border-blue-300' : 'bg-white hover:bg-blue-50'
                } ${day.holiday ? 'bg-yellow-50 hover:bg-yellow-100' : ''}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-sm font-medium ${isToday ? 'text-blue-600' : 'text-gray-900'}`}>
                    {date.getDate()}
                  </span>
                  {day.total > 0 && (
                    <Badge variant="outline" className="text-xs">
                      {day.total}
                    </Badge>
                  )}
                </div>
                
                {day.holiday && (
                  <div className="text-xs text-yellow-700 mb-1 font-medium">
                    {day.holiday}
                  </div>
                )}
                
                <div className="space-y-1">
                  {day.tasks.slice(0, 3).map(task => (
                    <div
                      key={task.id}
                      className={`text-xs p-1 rounded flex items-center space-x-1 ${getStatusColor(task.status)}`}
                    >
                      {getStatusIcon(task.status)}
                      <span className="truncate">{task.title}</span>
                    </div>
                  ))}
                  {day.tasks.length > 3 && (
                    <div className="text-xs text-gray-500">
                      +{day.tasks.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )
    }

    // Month view
    const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
    const startDate = new Date(firstDayOfMonth)
    startDate.setDate(startDate.getDate() - firstDayOfMonth.getDay())
    
    const days = []
    for (let i = 0; i < 42; i++) {
      const date = new Date(startDate)
      date.setDate(startDate.getDate() + i)
      const dateStr = date.toISOString().split('T')[0]
      const dayData = calendar.find(d => d.date === dateStr)
      
      days.push({
        date: dateStr,
        day: date.getDate(),
        isCurrentMonth: date.getMonth() === currentDate.getMonth(),
        isToday: dateStr === today,
        data: dayData || {
          date: dateStr,
          total: 0,
          completed: 0,
          pending: 0,
          overdue: 0,
          missed: 0,
          tasks: []
        }
      })
    }

    return (
      <div className="grid grid-cols-7 gap-1">
        {dayNames.map(day => (
          <div key={day} className="p-2 text-center font-medium text-gray-600 bg-gray-50">
            {day}
          </div>
        ))}
        {days.map((day, index) => (
          <div
            key={index}
            onClick={() => day.isCurrentMonth ? handleDayClick(day.date) : null}
            className={`min-h-24 p-1 border border-gray-200 transition-all duration-200 ${
              day.isCurrentMonth ? 'cursor-pointer hover:shadow-md hover:scale-[1.02] hover:border-blue-300' : 'cursor-not-allowed'
            } ${
              day.isToday ? 'bg-blue-50 border-blue-300' : 'bg-white'
            } ${
              day.isCurrentMonth && !day.isToday ? 'hover:bg-blue-50' : ''
            } ${
              !day.isCurrentMonth ? 'bg-gray-50 text-gray-400' : ''
            } ${
              day.data.holiday && day.isCurrentMonth ? 'bg-yellow-50 hover:bg-yellow-100' : ''
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className={`text-sm ${day.isToday ? 'font-bold text-blue-600' : 'font-medium'}`}>
                {day.day}
              </span>
              {day.data.total > 0 && (
                <Badge variant="outline" className="text-xs">
                  {day.data.total}
                </Badge>
              )}
            </div>
            
            {day.data.holiday && (
              <div className="text-xs text-yellow-700 mb-1 font-medium truncate">
                {day.data.holiday}
              </div>
            )}
            
            <div className="space-y-1">
              {day.data.tasks.slice(0, 2).map(task => (
                <div
                  key={task.id}
                  className={`text-xs p-1 rounded flex items-center space-x-1 ${getStatusColor(task.status)}`}
                >
                  {getStatusIcon(task.status)}
                  <span className="truncate">{task.title}</span>
                </div>
              ))}
              {day.data.tasks.length > 2 && (
                <div className="text-xs text-gray-500">
                  +{day.data.tasks.length - 2} more
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary)] mx-auto"></div>
          <p className="mt-2 text-[var(--color-text-secondary)]">Loading calendar...</p>
        </div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      <Navigation />

      <main className="max-w-content-lg mx-auto px-4 sm:px-6 lg:px-18 py-6 sm:py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-2">Task Calendar</h1>
          <p className="text-[var(--color-text-secondary)]">
            View and track daily tasks across the pharmacy
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => view === 'month' ? navigateMonth('prev') : navigateWeek('prev')}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            
            <div className="flex items-center space-x-2">
              <CalendarIcon className="w-4 h-4" />
              <span className="font-medium">
                {view === 'month' 
                  ? `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`
                  : `Week of ${currentDate.toLocaleDateString()}`
                }
              </span>
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => view === 'month' ? navigateMonth('next') : navigateWeek('next')}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex items-center space-x-2">
            <Select value={view} onValueChange={(value: "month" | "week") => setView(value)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">Month</SelectItem>
                <SelectItem value="week">Week</SelectItem>
              </SelectContent>
            </Select>

            {isAdmin && positions.length > 0 && (
              <Select value={selectedPosition} onValueChange={setSelectedPosition}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Positions</SelectItem>
                  {positions.map(position => (
                    <SelectItem key={position.id} value={position.id}>
                      {position.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentDate(new Date())}
            >
              Today
            </Button>
          </div>
        </div>

        {/* Summary Stats */}
        {calendarData && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <CalendarIcon className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Total Tasks</p>
                    <p className="text-lg font-semibold">{calendarData.summary.totalTasks}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Completed</p>
                    <p className="text-lg font-semibold">{calendarData.summary.completedTasks}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <div className="p-2 bg-yellow-100 rounded-lg">
                    <Clock className="w-4 h-4 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Pending</p>
                    <p className="text-lg font-semibold">{calendarData.summary.pendingTasks}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Overdue</p>
                    <p className="text-lg font-semibold">{calendarData.summary.overdueTasks}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Users className="w-4 h-4 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Completion Rate</p>
                    <p className="text-lg font-semibold">{calendarData.summary.completionRate}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Calendar Grid */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <CalendarIcon className="w-5 h-5" />
              <span>
                {view === 'month' ? 'Monthly' : 'Weekly'} Task Calendar
                {selectedPosition !== "all" && positions.length > 0 && (
                  <span className="text-sm font-normal text-gray-500 ml-2">
                    - {positions.find(p => p.id === selectedPosition)?.name}
                  </span>
                )}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {renderCalendarGrid()}
          </CardContent>
        </Card>

        {/* Legend */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">Legend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center space-x-2">
                <div className="flex items-center space-x-1 text-xs p-1 rounded bg-green-100 text-green-800 border-green-200">
                  <CheckCircle className="w-3 h-3" />
                  <span>Completed</span>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <div className="flex items-center space-x-1 text-xs p-1 rounded bg-blue-100 text-blue-800 border-blue-200">
                  <Clock className="w-3 h-3" />
                  <span>Pending</span>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <div className="flex items-center space-x-1 text-xs p-1 rounded bg-red-100 text-red-800 border-red-200">
                  <AlertTriangle className="w-3 h-3" />
                  <span>Overdue</span>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <div className="flex items-center space-x-1 text-xs p-1 rounded bg-gray-100 text-gray-800 border-gray-200">
                  <XCircle className="w-3 h-3" />
                  <span>Missed</span>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <div className="text-xs p-1 rounded bg-yellow-50 text-yellow-700 border border-yellow-200">
                  Public Holiday
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}