"use client"

import { useState, useEffect } from "react"
import { usePositionAuth } from "@/lib/position-auth-context"
import { Navigation } from "@/components/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { taskInstancesApi, positionsApi } from "@/lib/api-client"
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Users } from "lucide-react"

const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
]

interface CalendarEvent {
  date: string
  total: number
  done: number
  overdue: number
  missed: number
}

interface Position {
  id: string
  name: string
}

export default function CalendarPage() {
  const { user, isLoading } = usePositionAuth()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [events, setEvents] = useState<Record<string, CalendarEvent>>({})
  const [positions, setPositions] = useState<Position[]>([])
  const [selectedPosition, setSelectedPosition] = useState("all")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [currentDate, selectedPosition])

  const loadData = async () => {
    setLoading(true)
    try {
      // Load positions for filter
      if (positions.length === 0) {
        const positionsData = await positionsApi.getAll()
        setPositions(positionsData)
      }

      // Calculate date range for current month
      const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
      const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)
      const startDate = firstDay.toISOString().split('T')[0]
      const endDate = lastDay.toISOString().split('T')[0]

      // Load task instances for the month
      const filters = {
        dateRange: `${startDate},${endDate}`,
        ...(selectedPosition !== 'all' && { position_id: selectedPosition })
      }

      const tasks = await taskInstancesApi.getAll(filters)

      // Group tasks by date
      const eventsByDate: Record<string, CalendarEvent> = {}
      
      tasks.forEach(task => {
        const date = task.due_date
        if (!eventsByDate[date]) {
          eventsByDate[date] = {
            date,
            total: 0,
            done: 0,
            overdue: 0,
            missed: 0
          }
        }
        
        eventsByDate[date].total++
        
        switch (task.status) {
          case 'done':
            eventsByDate[date].done++
            break
          case 'overdue':
            eventsByDate[date].overdue++
            break
          case 'missed':
            eventsByDate[date].missed++
            break
        }
      })

      setEvents(eventsByDate)
    } catch (error) {
      console.error('Error loading calendar data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  const today = new Date()
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
  const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)
  const firstDayWeekday = firstDayOfMonth.getDay()
  const daysInMonth = lastDayOfMonth.getDate()

  const calendarDays = []
  
  // Add empty cells for days before month starts
  for (let i = 0; i < firstDayWeekday; i++) {
    calendarDays.push(null)
  }
  
  // Add days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day)
    const dateString = date.toISOString().split('T')[0]
    const event = events[dateString]
    
    calendarDays.push({
      date: day,
      dateString,
      isToday: date.toDateString() === today.toDateString(),
      isWeekend: date.getDay() === 0 || date.getDay() === 6, // Sunday or Saturday
      event
    })
  }

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev)
      newDate.setMonth(prev.getMonth() + (direction === 'next' ? 1 : -1))
      return newDate
    })
  }

  const handleDateClick = (dateString: string) => {
    // Navigate to checklist for this date
    const params = new URLSearchParams()
    params.append('date', dateString)
    if (selectedPosition !== 'all') {
      params.append('position_id', selectedPosition)
    }
    window.location.href = `/checklist?${params.toString()}`
  }

  const getCompletionRate = (event: CalendarEvent): number => {
    if (event.total === 0) return 0
    return (event.done / event.total) * 100
  }

  const getStatusColor = (event: CalendarEvent): string => {
    if (event.missed > 0) return 'border-red-400 bg-red-50'
    if (event.overdue > 0) return 'border-orange-400 bg-orange-50'
    if (event.done === event.total && event.total > 0) return 'border-green-400 bg-green-50'
    if (event.total > 0) return 'border-blue-400 bg-blue-50'
    return ''
  }

  // Calculate monthly statistics
  const monthStats = Object.values(events).reduce((acc, event) => ({
    total: acc.total + event.total,
    done: acc.done + event.done,
    overdue: acc.overdue + event.overdue,
    missed: acc.missed + event.missed
  }), { total: 0, done: 0, overdue: 0, missed: 0 })

  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      <Navigation />

      <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="pharmacy-gradient rounded-lg p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-2">Task Calendar</h1>
                <p className="text-white/90">View task distribution across days and navigate to specific dates</p>
              </div>
              <div className="text-right">
                <div className="text-sm text-white/80">
                  {monthStats.total} tasks this month
                </div>
                <div className="text-lg font-semibold">
                  {monthStats.total > 0 ? Math.round((monthStats.done / monthStats.total) * 100) : 0}% completed
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <Card className="card-surface mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Position Filter</label>
                  <Select value={selectedPosition} onValueChange={setSelectedPosition}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="All Positions" />
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
                </div>
              </div>

              {/* Month Statistics */}
              <div className="flex space-x-4 text-sm">
                <div className="text-center">
                  <div className="text-gray-600">Total</div>
                  <div className="font-semibold">{monthStats.total}</div>
                </div>
                <div className="text-center">
                  <div className="text-gray-600">Done</div>
                  <div className="font-semibold text-green-600">{monthStats.done}</div>
                </div>
                <div className="text-center">
                  <div className="text-gray-600">Overdue</div>
                  <div className="font-semibold text-orange-600">{monthStats.overdue}</div>
                </div>
                <div className="text-center">
                  <div className="text-gray-600">Missed</div>
                  <div className="font-semibold text-red-600">{monthStats.missed}</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Calendar */}
        <Card className="card-surface">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-2xl flex items-center">
                <CalendarIcon className="w-6 h-6 mr-2" />
                {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
              </CardTitle>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigateMonth('prev')}
                  disabled={loading}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentDate(new Date())}
                  disabled={loading}
                >
                  Today
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigateMonth('next')}
                  disabled={loading}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading calendar...</p>
              </div>
            ) : (
              <>
                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-1">
                  {/* Day headers */}
                  {daysOfWeek.map(day => (
                    <div
                      key={day}
                      className="p-2 text-center font-medium text-gray-600 border-b bg-gray-50"
                    >
                      {day}
                    </div>
                  ))}
                  
                  {/* Calendar days */}
                  {calendarDays.map((day, index) => (
                    <div
                      key={index}
                      className={`
                        min-h-[120px] border border-gray-200 p-2 cursor-pointer transition-all hover:shadow-md
                        ${day?.isToday ? 'ring-2 ring-blue-300 bg-blue-50' : ''}
                        ${day?.isWeekend ? 'bg-gray-50' : 'bg-white'}
                        ${day?.event ? getStatusColor(day.event) : ''}
                        ${!day ? 'bg-gray-100 cursor-not-allowed' : ''}
                      `}
                      onClick={() => day && handleDateClick(day.dateString)}
                    >
                      {day && (
                        <>
                          <div className="flex items-center justify-between mb-2">
                            <span className={`
                              text-sm font-medium 
                              ${day.isToday ? 'text-blue-700' : day.isWeekend ? 'text-gray-500' : 'text-gray-900'}
                            `}>
                              {day.date}
                            </span>
                            {day.isToday && (
                              <Badge variant="default" className="text-xs px-1 py-0">
                                Today
                              </Badge>
                            )}
                          </div>
                          
                          {day.event && day.event.total > 0 && (
                            <div className="space-y-1">
                              <div className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded flex items-center justify-between">
                                <span>{day.event.total} tasks</span>
                                <span>{Math.round(getCompletionRate(day.event))}%</span>
                              </div>
                              
                              {day.event.done > 0 && (
                                <div className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                                  ✓ {day.event.done} done
                                </div>
                              )}
                              
                              {day.event.overdue > 0 && (
                                <div className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">
                                  ⚠ {day.event.overdue} overdue
                                </div>
                              )}
                              
                              {day.event.missed > 0 && (
                                <div className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                                  ✗ {day.event.missed} missed
                                </div>
                              )}
                            </div>
                          )}

                          {/* Show weekends that have no work tasks */}
                          {day.isWeekend && (!day.event || day.event.total === 0) && (
                            <div className="text-xs text-gray-400 italic">No tasks</div>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
                
                {/* Legend */}
                <div className="mt-6 flex items-center justify-between">
                  <div className="flex items-center space-x-4 text-sm text-gray-600">
                    <div className="flex items-center">
                      <div className="w-4 h-4 bg-blue-50 border border-blue-300 rounded mr-2"></div>
                      <span>Today</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-4 h-4 bg-green-50 border border-green-400 rounded mr-2"></div>
                      <span>All completed</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-4 h-4 bg-orange-50 border border-orange-400 rounded mr-2"></div>
                      <span>Has overdue</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-4 h-4 bg-red-50 border border-red-400 rounded mr-2"></div>
                      <span>Has missed</span>
                    </div>
                  </div>
                  
                  <div className="text-sm text-gray-600">
                    Click any date to view detailed tasks
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}