import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { PositionAuthProvider } from "@/lib/position-auth-context"
import { ErrorBoundary } from "@/components/error-boundary"
import { AutoLogoutProvider } from "@/components/auto-logout-provider"
import { Toaster } from "@/components/ui/toaster"
import "./globals.css"

export const metadata: Metadata = {
  title: "Richmond Pharmacy Portal",
  description: "Internal task management and compliance system for pharmacy staff",
  generator: "v0.dev",
  keywords: ["pharmacy", "task management", "compliance", "intranet", "healthcare"],
  authors: [{ name: "Pharmacy Management System" }],
  robots: "noindex, nofollow", // Internal system
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        <style>{`
html {
  font-family: ${GeistSans.style.fontFamily};
  --font-sans: ${GeistSans.variable};
  --font-mono: ${GeistMono.variable};
}
        `}</style>
      </head>
      <body className="min-h-screen bg-[var(--color-background)] text-[var(--color-text-primary)] antialiased">
        <ErrorBoundary>
          <PositionAuthProvider>
            <AutoLogoutProvider>
              {children}
            </AutoLogoutProvider>
            <Toaster />
          </PositionAuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  )
}
