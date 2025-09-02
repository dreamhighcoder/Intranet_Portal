"use client"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { formatDate, getDateNavigation, formatLocalDate } from "@/lib/task-utils"
import { parseAustralianDate } from "@/lib/timezone-utils"
import { ChevronLeft, ChevronRight, CalendarIcon } from "lucide-react"
import { useState, useEffect, useRef } from "react"

interface DateNavigatorProps {
  currentDate: string
  onDateChange: (date: string) => void
}

export function DateNavigator({ currentDate, onDateChange }: DateNavigatorProps) {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  const mobileCalendarRef = useRef<HTMLDivElement | null>(null)
  const desktopCalendarRef = useRef<HTMLDivElement | null>(null)

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
      // Use local date to avoid timezone shifting to previous/next day
      onDateChange(formatLocalDate(date))
      setIsCalendarOpen(false)
    }
  }

  return (
    <div className="bg-white rounded-lg border border-[var(--color-border)] p-4">
      {/* Mobile Layout */}
      <div className="flex flex-col space-y-3 sm:hidden">
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDateChange(previous)}
            className="flex items-center space-x-1 flex-1 mr-2"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden xs:inline">Previous</span>
            <span className="xs:hidden">Prev</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onDateChange(next)}
            className="flex items-center space-x-1 flex-1 ml-2"
          >
            <span className="hidden xs:inline">Next</span>
            <span className="xs:hidden">Next</span>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex items-center justify-center relative" ref={mobileCalendarRef}>
          <Button
            type="button"
            variant="outline"
            className="flex items-center space-x-2 bg-transparent w-full justify-center"
            onClick={() => setIsCalendarOpen((v) => !v)}
          >
            <CalendarIcon className="w-4 h-4" />
            <span className="font-medium text-sm sm:text-base">{formatDate(currentDate)}</span>
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
            <Button
              variant="default"
              size="sm"
              onClick={() => onDateChange(today)}
              className="bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 text-white px-6"
            >
              Today
            </Button>
          </div>
        )}
      </div>

      {/* Desktop Layout */}
      <div className="hidden sm:flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDateChange(previous)}
            className="flex items-center space-x-1"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Previous</span>
          </Button>

          <div className="relative" ref={desktopCalendarRef}>
            <Button
              type="button"
              variant="outline"
              className="flex items-center space-x-2 bg-transparent"
              onClick={() => setIsCalendarOpen((v) => !v)}
            >
              <CalendarIcon className="w-4 h-4" />
              <span className="font-medium">{formatDate(currentDate)}</span>
            </Button>
            {isCalendarOpen && (
              <div className="absolute top-full mt-2 z-[9999]">
                <div className="w-auto p-0 bg-white border rounded-md shadow-md">
                  <Calendar mode="single" selected={parseAustralianDate(currentDate)} onSelect={handleDateSelect} initialFocus />
                </div>
              </div>
            )}
          </div>

          <Button variant="outline" size="sm" onClick={() => onDateChange(next)} className="flex items-center space-x-1">
            <span>Next</span>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex items-center space-x-2">
          {!isToday && (
            <Button
              variant="default"
              size="sm"
              onClick={() => onDateChange(today)}
              className="bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 text-white"
            >
              Today
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
