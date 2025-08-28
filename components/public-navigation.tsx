"use client"

import { Button } from "@/components/ui/button"
import Image from "next/image"
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
      <div className="max-w-content-lg mx-auto px-4 sm:px-6 lg:px-18">
        <div className="flex flex-wrap justify-between items-center gap-2 min-h-16 md:min-h-20 py-3 overflow-hidden">
          {/* Logo and Title */}
          <div className="flex items-center space-x-3 min-w-0">
            <Image
              src="/logo.png"
              alt="Pharmacy Logo"
              width={40}
              height={40}
              priority
            />
            <span className="font-semibold text-xl truncate">Richmond Pharmacy</span>
          </div>

          {/* Login Button */}
          <div className="flex items-center shrink-0">
            <Button
              onClick={onLoginClick}
              variant="outline"
              size="sm"
              className="border-white/20 hover:bg-white/10 bg-transparent flex items-center space-x-2 whitespace-nowrap"
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