"use client"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { formatDate, getDateNavigation } from "@/lib/task-utils"
import { ChevronLeft, ChevronRight, CalendarIcon } from "lucide-react"
import { useState } from "react"

interface DateNavigatorProps {
  currentDate: string
  onDateChange: (date: string) => void
}

export function DateNavigator({ currentDate, onDateChange }: DateNavigatorProps) {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  const { previous, next, today } = getDateNavigation(currentDate)
  const isToday = currentDate === today

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      onDateChange(date.toISOString().split("T")[0])
      setIsCalendarOpen(false)
    }
  }

  return (
    <div className="flex items-center justify-between bg-white rounded-lg border border-[var(--color-border)] p-4">
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

        <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="flex items-center space-x-2 bg-transparent">
              <CalendarIcon className="w-4 h-4" />
              <span className="font-medium">{formatDate(currentDate)}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={new Date(currentDate)} onSelect={handleDateSelect} initialFocus />
          </PopoverContent>
        </Popover>

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
            className="bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90"
          >
            Today
          </Button>
        )}
      </div>
    </div>
  )
}
