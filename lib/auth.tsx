"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect } from "react"
import type { User } from "./types"
import { mockUsers } from "./mock-data"

interface AuthContextType {
  user: User | null
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => void
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Check for existing session on mount
    const savedUser = localStorage.getItem("pharmacy-user")
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser))
      } catch (error) {
        localStorage.removeItem("pharmacy-user")
      }
    }
    setIsLoading(false)
  }, [])

  const login = async (email: string, password: string) => {
    setIsLoading(true)

    try {
      // Mock authentication - replace with Supabase later
      await new Promise((resolve) => setTimeout(resolve, 1000)) // Simulate API call

      console.log("Attempting login with:", { email, password })
      console.log(
        "Available users:",
        mockUsers.map((u) => ({ email: u.email, id: u.id })),
      )

      const foundUser = mockUsers.find((u) => u.email.toLowerCase() === email.toLowerCase())
      console.log("Found user:", foundUser)

      if (foundUser && password === "password") {
        // Mock password check
        setUser(foundUser)
        localStorage.setItem("pharmacy-user", JSON.stringify(foundUser))
        setIsLoading(false)
        console.log("Login successful for:", foundUser.email)
        return { success: true }
      }

      setIsLoading(false)
      console.log("Login failed - invalid credentials")
      return { success: false, error: "Invalid email or password" }
    } catch (error) {
      setIsLoading(false)
      console.error("Login error:", error)
      return { success: false, error: "Login failed due to an error" }
    }
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem("pharmacy-user")
  }

  return <AuthContext.Provider value={{ user, login, logout, isLoading }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
