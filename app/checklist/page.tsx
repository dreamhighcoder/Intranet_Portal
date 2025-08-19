'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { usePositionAuth } from '@/lib/position-auth-context'
import { Navigation } from '@/components/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { positionsApi } from '@/lib/api-client'
import { toKebabCase } from '@/lib/responsibility-mapper'
import { Users, ChevronRight, Calendar, CheckCircle, Clock, AlertTriangle } from 'lucide-react'

interface Position {
  id: string
  name: string
  displayName: string
  role: string
}

interface PositionStats {
  positionId: string
  total: number
  completed: number
  pending: number
  overdue: number
}

export default function ChecklistsPage() {
  const { user, isLoading, isAdmin } = usePositionAuth()
  const router = useRouter()
  const [positions, setPositions] = useState<Position[]>([])
  const [stats, setStats] = useState<Record<string, PositionStats>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/")
    }
  }, [user, isLoading, router])

  useEffect(() => {
    if (!isLoading && user) {
      if (isAdmin) {
        loadPositions()
      } else {
        // Non-admin users should go directly to their checklist
        const roleSlug = toKebabCase(user.position?.displayName || user.position?.name || 'user')
        router.push(`/checklist/${roleSlug}`)
      }
    }
  }, [user, isLoading, isAdmin, router])

  const loadPositions = async () => {
    try {
      setLoading(true)
      const positionsData = await positionsApi.getAll()
      
      // Filter out admin positions
      const filteredPositions = positionsData.filter(position => {
        const isAdminPosition = position.role === 'admin' || 
                               position.name.toLowerCase().includes('admin') || 
                               position.displayName?.toLowerCase().includes('admin')
        return !isAdminPosition
      })
      
      setPositions(filteredPositions)
      
      // Load stats for each position
      await loadPositionStats(filteredPositions)
    } catch (error) {
      console.error('Error loading positions:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadPositionStats = async (positions: Position[]) => {
    const today = new Date().toISOString().split('T')[0]
    const statsPromises = positions.map(async (position) => {
      try {
        const response = await fetch(`/api/public/task-counts?date=${today}&position_id=${position.id}`)
        if (response.ok) {
          const result = await response.json()
          if (result.success) {
            return {
              positionId: position.id,
              ...result.data
            }
          }
        }
      } catch (error) {
        console.error(`Error loading stats for position ${position.id}:`, error)
      }
      return {
        positionId: position.id,
        total: 0,
        completed: 0,
        pending: 0,
        overdue: 0
      }
    })

    const statsResults = await Promise.all(statsPromises)
    const statsMap = statsResults.reduce((acc, stat) => {
      acc[stat.positionId] = stat
      return acc
    }, {} as Record<string, PositionStats>)
    
    setStats(statsMap)
  }

  const handlePositionClick = (position: Position) => {
    const roleSlug = toKebabCase(position.displayName || position.name)
    router.push(`/checklist/${roleSlug}`)
  }

  const getAlertLevel = (stats: PositionStats) => {
    if (stats.overdue > 0) return 'high'
    if (stats.pending > 0) return 'medium'
    return 'low'
  }

  const getAlertColor = (level: string) => {
    switch (level) {
      case 'high': return 'text-red-600 bg-red-50 border-red-200'
      case 'medium': return 'text-orange-600 bg-orange-50 border-orange-200'
      default: return 'text-green-600 bg-green-50 border-green-200'
    }
  }

  if (isLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary)] mx-auto"></div>
          <p className="mt-2 text-[var(--color-text-secondary)]">Loading checklists...</p>
        </div>
      </div>
    )
  }

  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Access Denied</h1>
          <p className="text-gray-600">Admin access required to view all checklists.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      <Navigation />

      <main className="max-w-content-lg mx-auto px-4 sm:px-6 lg:px-18 py-6 sm:py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-2">Position Checklists</h1>
          <p className="text-[var(--color-text-secondary)]">
            View and manage daily checklists for all pharmacy positions
          </p>
        </div>

        {/* Position Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {positions.map((position) => {
            const positionStats = stats[position.id] || { total: 0, completed: 0, pending: 0, overdue: 0 }
            const alertLevel = getAlertLevel(positionStats)
            
            return (
              <Card 
                key={position.id} 
                className="card-surface hover:shadow-lg transition-all duration-200 cursor-pointer group"
                onClick={() => handlePositionClick(position)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 rounded-lg bg-[var(--color-primary)] text-white group-hover:scale-110 transition-transform">
                        <Users className="h-5 w-5" />
                      </div>
                      <CardTitle className="text-lg leading-tight">
                        {position.displayName || position.name}
                      </CardTitle>
                    </div>
                    
                    {positionStats.total > 0 && (
                      <Badge className={`${getAlertColor(alertLevel)} border`}>
                        <div className="flex items-center space-x-1">
                          {alertLevel === 'high' && <AlertTriangle className="h-3 w-3" />}
                          {alertLevel === 'medium' && <Clock className="h-3 w-3" />}
                          {alertLevel === 'low' && <CheckCircle className="h-3 w-3" />}
                          <span className="text-xs font-medium">
                            {positionStats.total} tasks
                          </span>
                        </div>
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                
                <CardContent className="pt-0">
                  <div className="space-y-2 mb-4">
                    {/* Total tasks */}
                    <div className="flex items-center justify-between text-sm px-2 py-1 bg-gray-50 rounded">
                      <span className="text-gray-700 font-medium flex items-center">
                        <span className="mr-1">📋</span> Total Tasks
                      </span>
                      <Badge variant="secondary" className="font-medium">{positionStats.total}</Badge>
                    </div>
                    
                    {/* Completed tasks */}
                    {positionStats.completed > 0 && (
                      <div className="flex items-center justify-between text-sm p-2 bg-green-50 rounded">
                        <span className="text-green-700 font-medium flex items-center">
                          <span className="mr-1">✅</span> Completed
                        </span>
                        <Badge className="bg-green-100 text-green-800 font-medium">{positionStats.completed}</Badge>
                      </div>
                    )}
                    
                    {/* Pending tasks */}
                    {positionStats.pending > 0 && (
                      <div className="flex items-center justify-between text-sm px-2 py-1 bg-orange-50 rounded">
                        <span className="text-orange-700 font-medium flex items-center">
                          <span className="mr-1">⏰</span> Pending
                        </span>
                        <Badge className="bg-orange-100 text-orange-800 font-medium">{positionStats.pending}</Badge>
                      </div>
                    )}
                    
                    {/* Overdue tasks */}
                    {positionStats.overdue > 0 && (
                      <div className="flex items-center justify-between text-sm px-2 py-1 bg-red-50 rounded">
                        <span className="text-red-700 font-medium flex items-center">
                          <span className="mr-1">⚠️</span> Overdue
                        </span>
                        <Badge className="bg-red-100 text-red-800 font-medium">{positionStats.overdue}</Badge>
                      </div>
                    )}
                    
                    {/* No tasks message */}
                    {positionStats.total === 0 && (
                      <div className="text-center py-2 text-gray-500">
                        No tasks scheduled for today
                      </div>
                    )}
                  </div>
                  
                  <Button
                    className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 text-[var(--color-primary-on)] border-0"
                  >
                    View Checklist
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {positions.length === 0 && !loading && (
          <div className="text-center py-12">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Positions Found</h3>
            <p className="text-gray-500">No pharmacy positions are currently configured.</p>
          </div>
        )}
      </main>
    </div>
  )
}