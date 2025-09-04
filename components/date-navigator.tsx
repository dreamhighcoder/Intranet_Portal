"use client"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { formatDate, getDateNavigation, formatLocalDate } from "@/lib/task-utils"
import { parseAustralianDate } from "@/lib/timezone-utils"
import { ChevronLeft, ChevronRight, CalendarIcon, Loader2 } from "lucide-react"
import { useState, useEffect, useRef } from "react"

interface DateNavigatorProps {
  currentDate: string
  onDateChange: (date: string) => void
  isLoading?: boolean
}

export function DateNavigator({ currentDate, onDateChange, isLoading = false }: DateNavigatorProps) {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  const [loadingButton, setLoadingButton] = useState<string | null>(null)
  const mobileCalendarRef = useRef<HTMLDivElement | null>(null)
  const desktopCalendarRef = useRef<HTMLDivElement | null>(null)

  // Reset loading button state when loading completes
  useEffect(() => {
    console.log('🔄 DateNavigator isLoading changed:', isLoading)
    if (!isLoading) {
      console.log('✅ Resetting loading button state')
      setLoadingButton(null)
    }
  }, [isLoading])

  // Close calendar when clicking outside (both mobile and desktop)
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node
      const mobileOpen = mobileCalendarRef.current && mobileCalendarRef.current.contains(target)
      const desktopOpen = desktopCalendarRef.current && desktopCalendarRef.current.contains(target)
      // If clicking outside of both dropdown containers and outside the trigger buttons
      if (!mobileOpen && !desktopOpen) {
        setIsCalendarOpen(false)
      }
    }

    if (isCalendarOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isCalendarOpen])
  const { previous, next, today } = getDateNavigation(currentDate)
  const isToday = currentDate === today

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setLoadingButton('calendar')
      // Use local date to avoid timezone shifting to previous/next day
      onDateChange(formatLocalDate(date))
      setIsCalendarOpen(false)
    }
  }

  const handleButtonClick = (buttonType: string, action: () => void) => {
    console.log('🔘 DateNavigator button clicked:', buttonType)
    setLoadingButton(buttonType)
    console.log('⏳ Loading button set to:', buttonType)
    action()
    console.log('✅ Action executed for button:', buttonType)
  }

  return (
    <div className="bg-white rounded-lg border border-[var(--color-border)] p-4">
      {/* Mobile Layout */}
      <div className="flex flex-col space-y-3 sm:hidden">
        <div className="flex items-center justify-between">
          <button
            type="button"
            className="flex items-center space-x-1 flex-1 mr-2 p-2 border rounded cursor-pointer hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isLoading && loadingButton === 'previous'}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              handleButtonClick('previous', () => onDateChange(previous))
            }}
          >
            {isLoading && loadingButton === 'previous' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="hidden xs:inline">Loading...</span>
                <span className="xs:hidden">Loading...</span>
              </>
            ) : (
              <>
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden xs:inline">Previous</span>
                <span className="xs:hidden">Prev</span>
              </>
            )}
          </button>

          <button
            type="button"
            className="flex items-center space-x-1 flex-1 ml-2 p-2 border rounded cursor-pointer hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isLoading && loadingButton === 'next'}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              handleButtonClick('next', () => onDateChange(next))
            }}
          >
            {isLoading && loadingButton === 'next' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="hidden xs:inline">Loading...</span>
                <span className="xs:hidden">Loading...</span>
              </>
            ) : (
              <>
                <span className="hidden xs:inline">Next</span>
                <span className="xs:hidden">Next</span>
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>

        <div className="flex items-center justify-center relative" ref={mobileCalendarRef}>
          <Button
            type="button"
            variant="outline"
            className="flex items-center space-x-2 bg-transparent w-full justify-center"
            disabled={isLoading && loadingButton === 'calendar'}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setIsCalendarOpen((v) => !v)
            }}
          >
            {isLoading && loadingButton === 'calendar' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="font-medium text-sm sm:text-base">Loading...</span>
              </>
            ) : (
              <>
                <CalendarIcon className="w-4 h-4" />
                <span className="font-medium text-sm sm:text-base">{formatDate(currentDate)}</span>
              </>
            )}
          </Button>
          {isCalendarOpen && (
            <div className="absolute top-full mt-2 z-[9999]">
              <div className="w-auto p-0 bg-white border rounded-md shadow-md">
                <Calendar mode="single" selected={parseAustralianDate(currentDate)} onSelect={handleDateSelect} initialFocus />
              </div>
            </div>
          )}
        </div>

        {!isToday && (
          <div className="flex justify-center">
            <button
              type="button"
              className="px-6 py-2 bg-blue-600 text-white rounded cursor-pointer hover:bg-blue-700 text-center disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoading && loadingButton === 'today'}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                handleButtonClick('today', () => onDateChange(today))
              }}
            >
              {isLoading && loadingButton === 'today' ? (
                <div className="flex items-center space-x-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Loading...</span>
                </div>
              ) : (
                'Today'
              )}
            </button>
          </div>
        )}
      </div>

      {/* Desktop Layout */}
      <div className="hidden sm:flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isLoading && loadingButton === 'previous'}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              handleButtonClick('previous', () => onDateChange(previous))
            }}
            className="flex items-center space-x-1"
          >
            {isLoading && loadingButton === 'previous' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Loading...</span>
              </>
            ) : (
              <>
                <ChevronLeft className="w-4 h-4" />
                <span>Previous</span>
              </>
            )}
          </Button>

          <div className="relative" ref={desktopCalendarRef}>
            <Button
              type="button"
              variant="outline"
              className="flex items-center space-x-2 bg-transparent"
              disabled={isLoading && loadingButton === 'calendar'}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setIsCalendarOpen((v) => !v)
              }}
            >
              {isLoading && loadingButton === 'calendar' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="font-medium">Loading...</span>
                </>
              ) : (
                <>
                  <CalendarIcon className="w-4 h-4" />
                  <span className="font-medium">{formatDate(currentDate)}</span>
                </>
              )}
            </Button>
            {isCalendarOpen && (
              <div className="absolute top-full mt-2 z-[9999]">
                <div className="w-auto p-0 bg-white border rounded-md shadow-md">
                  <Calendar mode="single" selected={parseAustralianDate(currentDate)} onSelect={handleDateSelect} initialFocus />
                </div>
              </div>
            )}
          </div>

          <Button 
            type="button" 
            variant="outline" 
            size="sm" 
            disabled={isLoading && loadingButton === 'next'}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              handleButtonClick('next', () => onDateChange(next))
            }} 
            className="flex items-center space-x-1"
          >
            {isLoading && loadingButton === 'next' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Loading...</span>
              </>
            ) : (
              <>
                <span>Next</span>
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </Button>
        </div>

        <div className="flex items-center space-x-2">
          {!isToday && (
            <Button
              type="button"
              variant="default"
              size="sm"
              disabled={isLoading && loadingButton === 'today'}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                handleButtonClick('today', () => onDateChange(today))
              }}
              className="bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 text-white"
            >
              {isLoading && loadingButton === 'today' ? (
                <div className="flex items-center space-x-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Loading...</span>
                </div>
              ) : (
                'Today'
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
