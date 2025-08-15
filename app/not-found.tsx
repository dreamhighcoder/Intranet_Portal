"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Home, ArrowLeft } from "lucide-react"

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-background)] px-4">
      <Card className="w-full max-w-md card-surface">
        <CardHeader className="text-center">
          <div className="mx-auto w-20 h-20 bg-[var(--color-primary)] rounded-full flex items-center justify-center mb-4">
            <span className="text-3xl font-bold text-white">404</span>
          </div>
          <CardTitle className="text-2xl text-[var(--color-text-primary)]">Page Not Found</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-[var(--color-text-secondary)]">
            The page you're looking for doesn't exist or has been moved. Please check the URL or navigate back to the
            homepage.
          </p>
          <div className="flex flex-col space-y-2">
            <Button asChild className="bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 text-[var(--color-primary-on)]">
              <Link href="/">
                <Home className="w-4 h-4 mr-2" />
                Go Home
              </Link>
            </Button>
            <Button variant="outline" onClick={() => window.history.back()}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go Back
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
