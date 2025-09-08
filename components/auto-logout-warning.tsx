"use client"

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { AlertTriangle, Clock } from "lucide-react"

interface AutoLogoutWarningProps {
  isOpen: boolean
  timeLeft: number // seconds
  onStayLoggedIn: () => void
  onLogout: () => void
}

export function AutoLogoutWarning({ 
  isOpen, 
  timeLeft: initialTimeLeft, 
  onStayLoggedIn, 
  onLogout 
}: AutoLogoutWarningProps) {
  const [timeLeft, setTimeLeft] = useState(initialTimeLeft)

  useEffect(() => {
    if (!isOpen) return

    setTimeLeft(initialTimeLeft)
    
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval)
          onLogout()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [isOpen, initialTimeLeft, onLogout])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    if (mins > 0) {
      return `${mins}:${secs.toString().padStart(2, '0')}`
    }
    return `${secs} seconds`
  }

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <DialogTitle>Session Timeout Warning</DialogTitle>
          </div>
          <DialogDescription className="space-y-2">
            <p>
              Your session will expire due to inactivity. You will be automatically 
              logged out in:
            </p>
            <div className="flex items-center justify-center space-x-2 p-4 bg-amber-50 rounded-lg border border-amber-200">
              <Clock className="h-5 w-5 text-amber-600" />
              <span className="text-lg font-mono font-semibold text-amber-800">
                {formatTime(timeLeft)}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Click "Stay Logged In" to continue your session, or "Logout Now" to logout immediately.
            </p>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={onLogout}
            className="w-full sm:w-auto"
          >
            Logout Now
          </Button>
          <Button
            onClick={onStayLoggedIn}
            className="w-full sm:w-auto"
          >
            Stay Logged In
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}