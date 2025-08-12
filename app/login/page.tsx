"use client"

import { LoginForm } from "@/components/login-form"
import { useAuth } from "@/lib/auth"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

export default function LoginPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && user) {
      router.push("/")
    }
  }, [user, isLoading, router])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary)] mx-auto"></div>
          <p className="mt-2 text-[var(--color-text-muted)]">Loading...</p>
        </div>
      </div>
    )
  }

  if (user) {
    return null // Will redirect to homepage
  }

  return <LoginForm />
}
