import React from 'react'
import Image from 'next/image'
import { Users, Stethoscope, Package, Building, Briefcase, UserCheck } from 'lucide-react'

// Position-specific icon mapping
const POSITION_ICON_MAP: Record<string, string> = {
  'pharmacy assistant': '/Pharmacy Assistant.png',
  'pharmacy assistants': '/Pharmacy Assistant.png', // Handle plural from seed data
  'dispensary technician': '/Dispensary Technician.png',
  'dispensary technicians': '/Dispensary Technician.png', // Handle plural from seed data
  'daa packer': '/DAA Packer.png',
  'daa packers': '/DAA Packer.png', // Handle plural from seed data
  'pharmacist (primary)': '/Pharmacist (Primary).png',
  'pharmacist (supporting)': '/Pharmacist (Supporting).png',
  'operational/managerial': '/Operational Managerial.png',
  'operational/ managerial': '/Operational Managerial.png', // Handle both variations
}

// Fallback icons for new positions (these should not reuse the specific position icons)
const FALLBACK_ICONS = [
  Users,
  Stethoscope, 
  Package,
  Building,
  Briefcase,
  UserCheck
]

// Component for rendering position-specific PNG icons with white filter
interface PositionPngIconProps {
  src: string
  alt: string
  className?: string
}

const PositionPngIcon: React.FC<PositionPngIconProps> = ({ src, alt, className = "h-5 w-5" }) => {
  return (
    <div 
      className={className} 
      style={{ 
        position: 'relative',
        // Scale up significantly to match Lucide icon visual weight
        transform: 'scale(1.3)',
      }}
    >
      <Image
        src={src}
        alt={alt}
        fill
        sizes="(max-width: 768px) 24px, 24px"
        style={{
          objectFit: 'contain',
          // Apply aggressive white filter with multiple effects for thicker appearance
          // filter: 'brightness(0) invert(1) contrast(3) saturate(2)',
        }}
        priority={false}
        loading="lazy"
      />
    </div>
  )
}

// Get icon component for a position
export function getPositionIcon(positionName: string, fallbackIndex: number = 0) {
  const normalizedName = positionName.toLowerCase().trim()
  
  // Check if this position has a specific PNG icon
  const pngPath = POSITION_ICON_MAP[normalizedName]
  
  if (pngPath) {
    console.log(`🖼️ Using PNG icon for: ${positionName} -> ${pngPath}`)
    // Return a component that renders the PNG icon
    return ({ className }: { className?: string }) => (
      <PositionPngIcon 
        src={pngPath} 
        alt={`${positionName} icon`} 
        className={className}
      />
    )
  }
  
  // For new positions, use fallback Lucide icons
  const FallbackIcon = FALLBACK_ICONS[fallbackIndex % FALLBACK_ICONS.length]
  console.log(`🔧 Using fallback Lucide icon for: ${positionName} (index: ${fallbackIndex})`)
  return FallbackIcon
}

// Get all position names that have specific icons (for validation)
export function getPositionsWithSpecificIcons(): string[] {
  return Object.keys(POSITION_ICON_MAP)
}

// Check if a position has a specific icon
export function hasSpecificIcon(positionName: string): boolean {
  const normalizedName = positionName.toLowerCase().trim()
  return normalizedName in POSITION_ICON_MAP
}