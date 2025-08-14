"use client"

import { Button } from "@/components/ui/button"
import { LogIn } from "lucide-react"

interface PublicNavigationProps {
  onLoginClick: () => void
}

export function PublicNavigation({ onLoginClick }: PublicNavigationProps) {
  return (
    <nav
      className="shadow-lg sticky top-0 z-50"
      style={{
        backgroundColor: "var(--color-primary)",
        color: "var(--color-primary-on)",
      }}
    >
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          {/* Logo and Title */}
          <div className="flex items-center space-x-3">
            <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 9.172V5L8 4z" />
            </svg>
            <span className="font-semibold text-xl">Richmond Pharmacy</span>
          </div>

          {/* Login Button */}
          <div className="flex items-center">
            <Button
              onClick={onLoginClick}
              variant="outline"
              size="sm"
              className="border-white/20 hover:bg-white/10 bg-transparent flex items-center space-x-2"
              style={{
                color: "var(--color-primary-on)",
                borderColor: "rgba(255, 255, 255, 0.2)",
              }}
            >
              <LogIn className="w-4 h-4" />
              <span>Login</span>
            </Button>
          </div>
        </div>
      </div>
    </nav>
  )
}