"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

import { useAuth } from "@/lib/auth"
import { toastError, toastSuccess } from "@/hooks/use-toast"

export function LoginForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  const { signIn, isLoading } = useAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    setIsSubmitting(true)

    if (!email || !password) {
      toastError("Validation Error", "Please enter both email and password")
      setIsSubmitting(false)
      return
    }

    try {
      const { error: signInError } = await signIn(email.trim(), password)

      if (signInError) {
        // Provide more helpful error messages
        let errorMessage = signInError.message || "Login failed"
        
        if (signInError.message?.includes("Invalid login credentials")) {
          errorMessage = "Invalid email or password. Make sure you've created this user in Supabase Dashboard → Authentication → Users."
        } else if (signInError.message?.includes("Email not confirmed")) {
          errorMessage = "Please confirm your email address before logging in."
        } else if (signInError.message?.includes("Too many requests")) {
          errorMessage = "Too many login attempts. Please wait a moment and try again."
        }
        
        toastError("Login Failed", errorMessage)
      } else {
        window.location.href = "/"
      }
    } catch (error) {
      toastError("Connection Error", "Please check your internet connection and try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)] px-4">
      <Card className="w-full max-w-md bg-[var(--color-surface)] border-[var(--color-border)]">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-[var(--color-primary)] rounded-lg flex items-center justify-center">
            <svg
              className="w-8 h-8 text-[var(--color-primary-on)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 9.172V5L8 4z"
              />
            </svg>
          </div>
          <CardTitle className="text-2xl font-semibold text-[var(--color-text)]">Intranet Portal Login</CardTitle>
          <CardDescription className="text-[var(--color-text-muted)]">
            Sign in to access your pharmacy dashboard
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">


            <div className="space-y-2">
              <Label htmlFor="email" className="text-[var(--color-text)]">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading || isSubmitting}
                className="bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text)]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-[var(--color-text)]">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading || isSubmitting}
                className="bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text)]"
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 text-[var(--color-primary-on)] border-0"
              disabled={isLoading || isSubmitting}
            >
              {isLoading || isSubmitting ? "Signing in..." : "Login"}
            </Button>

            <div className="text-center">
              <Button variant="link" className="text-[var(--color-primary)] hover:text-[var(--color-primary)]/80">
                Forgot Password?
              </Button>
            </div>
          </form>

          <div className="mt-6 p-4 bg-[var(--color-tertiary)] rounded-lg">
            <p className="text-sm text-[var(--color-text)] mb-2 font-medium">Demo Setup Required:</p>
            
            <div className="mt-3 flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setEmail("admin@pharmacy.com")
                  setPassword("password123")
                }}
                className="text-xs bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-secondary)]"
              >
                Fill Admin
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setEmail("pharmacist@pharmacy.com")
                  setPassword("password123")
                }}
                className="text-xs bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-secondary)]"
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
