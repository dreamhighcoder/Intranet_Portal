"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"

export default function LoginPage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to homepage where users can use the modal login system
    router.push("/")
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary)] mx-auto"></div>
        <p className="mt-2 text-[var(--color-text-muted)]">Redirecting to homepage...</p>
      </div>
    </div>
  )
}
