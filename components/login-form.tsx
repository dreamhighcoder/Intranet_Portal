"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useAuth } from "@/lib/auth"

export function LoginForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const { login, isLoading } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    console.log("Form submitted with:", { email, password })

    if (!email || !password) {
      setError("Please enter both email and password")
      return
    }

    try {
      const result = await login(email.trim(), password)
      console.log("Login result:", result)

      if (!result.success) {
        setError(result.error || "Login failed")
      }
    } catch (error) {
      console.error("Login form error:", error)
      setError("An unexpected error occurred")
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-background)] px-4">
      <Card className="w-full max-w-md card-surface">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-[var(--color-primary)] rounded-lg flex items-center justify-center">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 9.172V5L8 4z"
              />
            </svg>
          </div>
          <CardTitle className="text-2xl font-semibold text-[var(--color-text-primary)]">
            Intranet Portal Login
          </CardTitle>
          <CardDescription className="text-[var(--color-text-secondary)]">
            Sign in to access your pharmacy dashboard
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90"
              disabled={isLoading}
            >
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>

            <div className="text-center">
              <Button variant="link" className="text-[var(--color-secondary)]">
                Forgot Password?
              </Button>
            </div>
          </form>

          <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-2 font-medium">Demo Credentials:</p>
            <div className="space-y-1">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                <span className="font-medium">Admin:</span> admin@pharmacy.com / password
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                <span className="font-medium">User:</span> pharmacist@pharmacy.com / password
              </p>
            </div>
            <div className="mt-3 flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setEmail("admin@pharmacy.com")
                  setPassword("password")
                }}
                className="text-xs"
              >
                Fill Admin
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setEmail("pharmacist@pharmacy.com")
                  setPassword("password")
                }}
                className="text-xs"
              >
                Fill User
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
