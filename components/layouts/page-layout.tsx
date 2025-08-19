'use client'

import React from 'react'
import { Container } from '@/components/ui/container'
import { Navigation } from '@/components/navigation'
import { cn } from '@/lib/utils'

interface PageLayoutProps {
  children: React.ReactNode
  title?: string
  description?: string
  containerSize?: 'default' | 'narrow' | 'wide'
  className?: string
  showHeader?: boolean
  headerContent?: React.ReactNode
}

/**
 * Standard page layout component with responsive container
 */
export function PageLayout({
  children,
  title,
  description,
  containerSize = 'default',
  className,
  showHeader = true,
  headerContent,
}: PageLayoutProps) {
  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      <Navigation />
      
      <Container size={containerSize} className={cn('py-8', className)}>
        {showHeader && (title || description) && (
          <div className="mb-6">
            {title && (
              <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-text-primary)] mb-2">
                {title}
              </h1>
            )}
            {description && (
              <p className="text-[var(--color-text-secondary)] text-sm sm:text-base">
                {description}
              </p>
            )}
          </div>
        )}
        
        {headerContent && (
          <div className="mb-6">
            {headerContent}
          </div>
        )}
        
        {children}
      </Container>
    </div>
  )
}