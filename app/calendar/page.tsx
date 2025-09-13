"use client"

import { useState, useEffect } from "react"
import { usePositionAuth } from "@/lib/position-auth-context"
import { Navigation } from "@/components/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { authenticatedGet, positionsApi } from "@/lib/api-client"
import { toastError } from "@/hooks/use-toast"
import { toKebabCase } from "@/lib/responsibility-mapper"
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  CheckCircle,
  Clock,
  AlertTriangle,
  XCircle,
  Users,
  Loader2
} from "lucide-react"
import { useRouter } from "next/navigation"
import { getAustralianToday, formatAustralianDate, toAustralianTime, getAustralianNow, parseAustralianDate } from "@/lib/timezone-utils"
import { calculateTaskStatus } from "@/lib/task-status-calculator"

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

const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

export default function CalendarPage() {
  const { user, isLoading: authLoading, isAdmin } = usePositionAuth()
  const router = useRouter()

  const [calendarData, setCalendarData] = useState<CalendarData | null>(null)
  const [positions, setPositions] = useState<Position[]>([])
  const [loading, setLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(getAustralianNow())
  const [selectedPosition, setSelectedPosition] = useState<string>("all")
  const [datePickerOpen, setDatePickerOpen] = useState(false)
  const [loadingButton, setLoadingButton] = useState<string | null>(null)

  // Ensure non-admins are locked to their own position
  useEffect(() => {
    if (!authLoading && user && !isAdmin) {
      if (user.id && selectedPosition !== user.id) {
        setSelectedPosition(user.id)
      }
    }
  }, [authLoading, user, isAdmin])
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

    // Listen for task completion events to refresh calendar data
    const onTaskStatusChanged = () => {
      console.log('Calendar: Task status changed, refreshing calendar data')
      loadCalendarData()
    }

    const onTasksChanged = () => {
      console.log('Calendar: Tasks changed, refreshing calendar data')
      loadCalendarData()
    }

    window.addEventListener('task-status-changed', onTaskStatusChanged)
    window.addEventListener('tasks-changed', onTasksChanged)

    return () => {
      window.removeEventListener('task-status-changed', onTaskStatusChanged)
      window.removeEventListener('tasks-changed', onTasksChanged)
    }
  }, [authLoading, user, currentDate, selectedPosition, view])

  // Reset loading button state when loading completes
  useEffect(() => {
    if (!loading) {
      setLoadingButton(null)
    }
  }, [loading])

  const loadPositions = async () => {
    if (!isAdmin) return

    try {
      const positionsData = await positionsApi.getAll()
      // Filter out only exact 'Administrator'
      const filteredPositions = positionsData.filter(position => position.name !== 'Administrator')
      setPositions(filteredPositions)
    } catch (error) {
      console.error('Error loading positions:', error)
    }
  }

  const loadCalendarData = async () => {
    // Only show full page loading on initial load
    if (!calendarData) {
      setLoading(true)
    }

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
        params.append('date', formatAustralianDate(currentDate))
      }

      const url = `/api/calendar?${params.toString()}`
      const data = await authenticatedGet(url)
      setCalendarData(data)
    } catch (error) {
      console.error('Calendar Page - Error loading calendar data:', error)
      toastError("Error", "Failed to load calendar data")
    } finally {
      setLoading(false)
      setLoadingButton(null)
    }
  }

  const navigateMonth = (direction: 'prev' | 'next') => {
    const buttonType = direction === 'prev' ? 'prev' : 'next'
    setLoadingButton(buttonType)

    // Create a new Australian date based on current date
    const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate())
    if (direction === 'prev') {
      newDate.setMonth(newDate.getMonth() - 1)
    } else {
      newDate.setMonth(newDate.getMonth() + 1)
    }
    setCurrentDate(newDate)
  }

  const navigateWeek = (direction: 'prev' | 'next') => {
    const buttonType = direction === 'prev' ? 'prev' : 'next'
    setLoadingButton(buttonType)

    // Create a new Australian date based on current date
    const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate())
    if (direction === 'prev') {
      newDate.setDate(newDate.getDate() - 7)
    } else {
      newDate.setDate(newDate.getDate() + 7)
    }
    setCurrentDate(newDate)
  }

  const handleDatePickerSelect = (date: Date | undefined) => {
    if (date) {
      setLoadingButton('calendar')
      setCurrentDate(date)
      setDatePickerOpen(false)
    }
  }

  const handleTodayClick = () => {
    setLoadingButton('today')
    setCurrentDate(getAustralianNow())
  }

  const handleViewChange = (newView: "month" | "week") => {
    setLoadingButton('view')
    setView(newView)
  }

  const handlePositionChange = (newPosition: string) => {
    setLoadingButton('position')
    setSelectedPosition(newPosition)
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

  // Get summary stats from API - now correctly calculated for current time
  const getSummaryStats = () => {
    if (!calendarData || !calendarData.summary) return null

    return {
      totalTasks: calendarData.summary.totalTasks,
      completedTasks: calendarData.summary.completedTasks,
      pendingTasks: calendarData.summary.pendingTasks,
      overdueTasks: calendarData.summary.overdueTasks,
      missedTasks: calendarData.summary.missedTasks,
      completionRate: calendarData.summary.completionRate
    }
  }

  const handleDayClick = (date: string) => {
    if (isAdmin) {
      // For admin users, navigate to admin checklist view with position filter applied
      let targetRole = 'administrator' // Admin role
      let url = `/checklist/${targetRole}?date=${date}&admin_mode=true`

      // If a specific position is selected, add it as a responsibility filter parameter
      if (selectedPosition !== "all") {
        // Find the selected position and convert its name to responsibility format
        const selectedPositionData = positions.find(p => p.id === selectedPosition)
        if (selectedPositionData) {
          // Convert position name to kebab-case responsibility format
          const responsibilityName = toKebabCase(selectedPositionData.name)
          url += `&responsibility_filter=${responsibilityName}`
        }
      }

      router.push(url)
    } else {
      // For regular users, navigate to their specific checklist
      let targetRole = 'pharmacist-in-charge' // default role

      if (user?.position?.name) {
        // Convert position name to kebab-case for URL using the proper utility function
        targetRole = toKebabCase(user.position.name)
      }

      router.push(`/checklist/${targetRole}?date=${date}`)
    }
  }

  const renderCalendarGrid = () => {
    if (!calendarData) return null

    const { calendar } = calendarData
    const today = getAustralianToday()

    if (view === "week") {
      return (
        <div className="grid grid-cols-7 gap-1">
          {dayNames.map(day => (
            <div key={day} className="p-2 text-center font-medium text-gray-600 bg-gray-50">
              {day}
            </div>
          ))}
          {calendar.map((day, index) => {
            // Interpret server date as Australian local date for display
            const date = toAustralianTime(new Date(day.date))
            const isToday = day.date === today

            return (
              <div
                key={day.date}
                onClick={() => handleDayClick(day.date)}
                className={`min-h-32 p-2 border rounded-lg cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-[1.02] hover:border-blue-300 ${isToday ? 'bg-blue-50 border-blue-500 border-2 shadow-sm' : 'border-gray-200 bg-white hover:bg-blue-50'
                  } ${day.holiday ? 'bg-yellow-50 hover:bg-yellow-100' : ''}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-sm font-medium ${isToday ? 'text-blue-600' : 'text-gray-900'}`}>
                    {date.getDate()}
                  </span>
                  {day.total > 0 && (
                    <Badge variant="outline" className="text-xs shrink-0">
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
                  {day.tasks.slice(0, 2).map((task, taskIndex) => (
                    <div
                      key={`${task.id}-${day.date}-${taskIndex}`}
                      className={`text-xs p-1 rounded flex items-center space-x-1 ${getStatusColor(task.status)}`}
                    >
                      {getStatusIcon(task.status)}
                      <span className="truncate">{task.title}</span>
                    </div>
                  ))}
                  {day.tasks.length > 3 && (
                    <div className="text-xs text-gray-500 truncate">
                      +{day.tasks.length - 2} more
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
    // Compute grid using Australian timezone to avoid UTC shifts
    const ausFirst = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
    const startDate = new Date(ausFirst.getFullYear(), ausFirst.getMonth(), ausFirst.getDate())
    // Align month grid to start on Monday
    const dayOfWeek = ausFirst.getDay() // 0=Sun,1=Mon,...
    const diffToMonday = (dayOfWeek + 6) % 7
    startDate.setDate(startDate.getDate() - diffToMonday)

    const days = []
    for (let i = 0; i < 42; i++) {
      const date = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + i)
      const dateStr = formatAustralianDate(date)
      const dayData = calendar.find(d => d.date === dateStr)

      days.push({
        date: dateStr,
        day: date.getDate(),
        isCurrentMonth: date.getMonth() === ausFirst.getMonth(),
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
            className={`min-h-24 p-2 border rounded-lg transition-all duration-200 ${day.isCurrentMonth ? 'cursor-pointer hover:shadow-md hover:scale-[1.02] hover:border-blue-300' : 'cursor-not-allowed'
              } ${day.isToday ? 'bg-blue-50 border-blue-300 border-2 shadow-sm' : 'border-gray-200 bg-white'
              } ${day.isCurrentMonth && !day.isToday ? 'hover:bg-blue-50' : ''
              } ${!day.isCurrentMonth ? 'bg-gray-50 text-gray-400' : ''
              } ${day.data.holiday && day.isCurrentMonth ? 'bg-yellow-50 hover:bg-yellow-100' : ''
              }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className={`text-sm ${day.isToday ? 'font-bold text-blue-600' : 'font-medium'}`}>
                {day.day}
              </span>
              {day.data.total > 0 && (
                <Badge variant="outline" className="text-xs shrink-0">
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
              {day.data.tasks.slice(0, 2).map((task, taskIndex) => (
                <div
                  key={`${task.id}-${day.date}-${taskIndex}`}
                  className={`text-xs p-1 rounded flex items-center space-x-1 ${getStatusColor(task.status)}`}
                >
                  {getStatusIcon(task.status)}
                  <span className="truncate">{task.title}</span>
                </div>
              ))}
              {day.data.tasks.length > 2 && (
                <div className="text-xs text-gray-500 truncate">
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
        <div className="pharmacy-gradient rounded-lg p-4 sm:p-6 text-white mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">Task Calendar</h1>
          <p className="text-white/90 text-sm sm:text-base">
            View and track daily tasks across the pharmacy
          </p>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-lg border border-[var(--color-border)] p-4 flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => view === 'month' ? navigateMonth('prev') : navigateWeek('prev')}
              disabled={loadingButton === 'prev'}
            >
              {loadingButton === 'prev' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ChevronLeft className="w-4 h-4" />
              )}
            </Button>

            <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="flex items-center space-x-2 font-medium hover:bg-blue-50"
                  disabled={loadingButton === 'calendar'}
                >
                  {loadingButton === 'calendar' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Loading...</span>
                    </>
                  ) : (
                    <>
                      <CalendarIcon className="w-4 h-4" />
                      <span>
                        {view === 'month'
                          ? `${monthNames[toAustralianTime(currentDate).getMonth()]} ${toAustralianTime(currentDate).getFullYear()}`
                          : `Week of ${formatAustralianDate(currentDate)}`
                        }
                      </span>
                    </>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={currentDate}
                  onSelect={handleDatePickerSelect}
                  initialFocus
                  captionLayout="dropdown"
                />
              </PopoverContent>
            </Popover>

            <Button
              variant="outline"
              size="sm"
              onClick={() => view === 'month' ? navigateMonth('next') : navigateWeek('next')}
              disabled={loadingButton === 'next'}
            >
              {loadingButton === 'next' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleTodayClick}
              disabled={loadingButton === 'today'}
            >
              {loadingButton === 'today' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                  Loading...
                </>
              ) : (
                'Today'
              )}
            </Button>
          </div>

          <div className="flex items-center space-x-2">
            <Select value={view} onValueChange={handleViewChange} disabled={loadingButton === 'view'}>
              <SelectTrigger className="w-32">
                {loadingButton === 'view' ? (
                  <div className="flex items-center">
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    <span>Loading...</span>
                  </div>
                ) : (
                  <SelectValue />
                )}
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">Month</SelectItem>
                <SelectItem value="week">Week</SelectItem>
              </SelectContent>
            </Select>

            {isAdmin && positions.length > 0 && (
              <Select value={selectedPosition} onValueChange={handlePositionChange} disabled={loadingButton === 'position'}>
                <SelectTrigger className="w-full">
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
          </div>
        </div>

        {/* Summary Stats */}
        {calendarData && (() => {
          const summaryStats = getSummaryStats()
          if (!summaryStats) return null

          return (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
              <Card className="bg-white rounded-lg border border-[var(--color-border)] py-4 flex flex-col sm:flex-row gap-4">
                <CardContent>
                  <div className="flex items-center space-x-4">
                    <div className="p-2 bg-pink-100 rounded-lg">
                      <CalendarIcon className="w-6 h-6 text-pink-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 hidden sm:inline">Total Tasks</p>
                      <p className="text-lg font-semibold">{summaryStats.totalTasks}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white rounded-lg border border-[var(--color-border)] py-4 flex flex-col sm:flex-row gap-4">
                <CardContent>
                  <div className="flex items-center space-x-4">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <CheckCircle className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 hidden sm:inline">Completed</p>
                      <p className="text-lg font-semibold">{summaryStats.completedTasks}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white rounded-lg border border-[var(--color-border)] py-4 flex flex-col sm:flex-row gap-4">
                <CardContent>
                  <div className="flex items-center space-x-4">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Clock className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 hidden sm:inline">Pending</p>
                      <p className="text-lg font-semibold">{summaryStats.pendingTasks}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white rounded-lg border border-[var(--color-border)] py-4 flex flex-col sm:flex-row gap-4">
                <CardContent>
                  <div className="flex items-center space-x-4">
                    <div className="p-2 bg-red-100 rounded-lg">
                      <AlertTriangle className="w-6 h-6 text-red-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 hidden sm:inline">Overdue</p>
                      <p className="text-lg font-semibold">{summaryStats.overdueTasks}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white rounded-lg border border-[var(--color-border)] py-4 flex flex-col sm:flex-row gap-4">
                <CardContent>
                  <div className="flex items-center space-x-4">
                    <div className="p-2 bg-gray-200 rounded-lg">
                      <XCircle className="w-6 h-6 text-gray-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 hidden sm:inline">Missed</p>
                      <p className="text-lg font-semibold">{summaryStats.missedTasks}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>


              <Card className="bg-white rounded-lg border border-[var(--color-border)] py-4 flex flex-col sm:flex-row gap-4">
                <CardContent>
                  <div className="flex items-center space-x-4">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <Users className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 hidden sm:inline">Completion Rate</p>
                      <p className="text-lg font-semibold">{summaryStats.completionRate}%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )
        })()}

        {/* Calendar Grid */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <CalendarIcon className="w-5 h-5" />
              <span className="text-lg">
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
        <Card className="mt-6 gap-2">
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
                <div className="flex items-center space-x-1 text-xs p-1 rounded bg-gray-200 text-gray-800 border-gray-200">
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