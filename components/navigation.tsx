"use client"

import { Button } from "@/components/ui/button"
import { usePositionAuth } from "@/lib/position-auth-context"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useState } from "react"
import { Menu, X, LogOut, User } from "lucide-react"
import { toastSuccess } from "@/hooks/use-toast"


export function Navigation() {
  const { user, isLoading, signOut, isAdmin } = usePositionAuth()
  const pathname = usePathname()
  const router = useRouter()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)


  if (!user) return null

  // Don't render navigation until user is fully loaded
  if (isLoading) {
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
            <div className="flex items-center space-x-8">
              <div className="flex items-center space-x-3">
                <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 9.172V5L8 4z" />
                </svg>
                <span className="font-semibold text-xl">Richmond Pharmacy</span>
              </div>
            </div>
            <div className="hidden md:flex items-center space-x-4">
              <div className="animate-pulse">
                <div className="h-4 bg-white/20 rounded w-20"></div>
              </div>
            </div>
          </div>
        </div>
      </nav>
    )
  }

  // Navigation items based on role
  const navItems = isAdmin
    ? [
        { href: "/admin", label: "Dashboard" },
        { href: "/checklist", label: "Checklists" },
        { href: "/calendar", label: "Calendar" },
        { href: "/admin/reports", label: "Reports" },
      ]
    : [
        { href: "/checklist", label: "Checklist" },
        { href: "/calendar", label: "Calendar" },
      ]

  const handleLogout = async () => {
    signOut()
    toastSuccess(
      "Logged out",
      "You have been successfully logged out."
    )
    // Redirect to home page after logout
    router.push('/')
  }

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
          <div className="flex items-center space-x-8">
            {/* Logo and Title - No link since we're in authenticated state */}
            <div className="flex items-center space-x-3">
              <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 9.172V5L8 4z" />
              </svg>
              <span className="font-semibold text-xl">Richmond Pharmacy</span>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex space-x-4">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                    pathname === item.href ? "shadow-sm" : "hover:bg-white/10"
                  }`}
                  style={
                    pathname === item.href
                      ? {
                          backgroundColor: "var(--color-secondary)",
                          color: "var(--color-text)",
                        }
                      : {
                          color: "rgba(255, 255, 255, 0.8)",
                        }
                  }
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Desktop User Menu */}
          <div className="hidden md:flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-sm" style={{ color: "rgba(255, 255, 255, 0.8)" }}>
              <User className="w-4 h-4" />
              <span>
                Welcome, {user.position.displayName === "Administrator" ? "Administrator" : user.position.displayName}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="border-white/20 hover:bg-white/10 bg-transparent flex items-center space-x-1"
              style={{
                color: "var(--color-primary-on)",
                borderColor: "rgba(255, 255, 255, 0.2)",
              }}
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </Button>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="hover:bg-white/10"
              style={{ color: "var(--color-primary-on)" }}
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-white/20 py-4">
            <div className="space-y-2">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`block px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    pathname === item.href ? "" : "hover:bg-white/10"
                  }`}
                  style={
                    pathname === item.href
                      ? {
                          backgroundColor: "var(--color-secondary)",
                          color: "var(--color-text)",
                        }
                      : {
                          color: "rgba(255, 255, 255, 0.8)",
                        }
                  }
                >
                  {item.label}
                </Link>
              ))}
              <div className="border-t border-white/20 pt-2 mt-2">
                <div className="px-3 py-2 text-sm" style={{ color: "rgba(255, 255, 255, 0.8)" }}>
                  Welcome, {user.position.displayName === "Administrator" ? "Administrator" : user.position.displayName}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  className="w-full justify-start hover:bg-white/10 px-3"
                  style={{ color: "var(--color-primary-on)" }}
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
