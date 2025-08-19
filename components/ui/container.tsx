import React from 'react'
import { cn } from '@/lib/utils'

interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'default' | 'narrow' | 'wide'
}

/**
 * Responsive container component that maintains consistent width and padding across the application
 * 
 * Sizes:
 * - xs: Very narrow content (forms, login screens)
 * - sm: Small content (narrow forms, simple pages)
 * - md: Medium content (standard forms, content pages)
 * - lg: Large content (dashboards, data tables)
 * - xl: Extra large content (complex dashboards)
 * - default: Standard content width (alias for 'lg')
 * - narrow: Narrow content (alias for 'sm')
 * - wide: Wide content (alias for 'xl')
 */
export function Container({
  children,
  className,
  size = 'default',
  ...props
}: ContainerProps) {
  return (
    <div
      className={cn(
        'w-full mx-auto px-4 sm:px-6 lg:px-8',
        {
          // New size options
          'max-w-[480px]': size === 'xs',
          'max-w-content-sm': size === 'sm' || size === 'narrow',
          'max-w-content-md': size === 'md',
          'max-w-content-lg': size === 'lg' || size === 'default',
          'max-w-content-xl': size === 'xl' || size === 'wide',
          
          // Legacy options (maintained for backward compatibility)
          'max-w-content': size === 'default' && size !== 'lg',
          'max-w-3xl': size === 'narrow' && size !== 'sm',
          'max-w-7xl': size === 'wide' && size !== 'xl',
        },
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}