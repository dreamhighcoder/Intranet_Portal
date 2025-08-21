/**
 * Responsibility Mapper Utility
 *
 * Normalizes and maps responsibility values between stored/display strings and
 * a kebab-case form for internal checks. Avoids hardcoded role lists by
 * slugifying arbitrary position names. Shared responsibility options are
 * handled explicitly.
 */

// Shared responsibility labels and their kebab equivalents
const SHARED_LABELS = {
  incPharmacist: 'Shared (inc. Pharmacist)',
  excPharmacist: 'Shared (exc. Pharmacist)'
} as const

const SHARED_KEBAB = {
  incPharmacist: 'shared-inc-pharmacist',
  excPharmacist: 'shared-exc-pharmacist'
} as const

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[()/]/g, ' ') // normalize punctuation
    .replace(/[^a-z0-9]+/g, '-') // non-alphanum to dash
    .replace(/^-+|-+$/g, '') // trim dashes
}

function isSharedLabel(value: string): value is typeof SHARED_LABELS[keyof typeof SHARED_LABELS] {
  return value === SHARED_LABELS.incPharmacist || value === SHARED_LABELS.excPharmacist
}

function isSharedKebab(value: string): value is typeof SHARED_KEBAB[keyof typeof SHARED_KEBAB] {
  return value === SHARED_KEBAB.incPharmacist || value === SHARED_KEBAB.excPharmacist
}

/**
 * Convert a responsibility value to kebab-case format
 * Accepts display strings (e.g., "Pharmacist (Primary)" or shared labels)
 * or already-kebab strings and returns a kebab-case value.
 */
export function toKebabCase(responsibility: string): string {
  if (!responsibility) return responsibility

  // Shared labels map to fixed kebab values
  if (isSharedLabel(responsibility)) {
    return responsibility === SHARED_LABELS.incPharmacist
      ? SHARED_KEBAB.incPharmacist
      : SHARED_KEBAB.excPharmacist
  }

  // Already a shared kebab
  if (isSharedKebab(responsibility)) return responsibility

  // Generic slug for arbitrary position names
  return slugify(responsibility)
}

/**
 * Convert a responsibility value to display format
 * - Shared kebab -> Shared label
 * - Kebab for arbitrary names -> Title-cased best-effort
 * - Otherwise return as-is (assume already a display string)
 */
export function toDisplayFormat(responsibility: string): string {
  if (!responsibility) return responsibility

  if (responsibility === SHARED_KEBAB.incPharmacist) return SHARED_LABELS.incPharmacist
  if (responsibility === SHARED_KEBAB.excPharmacist) return SHARED_LABELS.excPharmacist

  // Heuristic: if looks like kebab, title-case it for display fallback
  if (/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(responsibility)) {
    return responsibility
      .split('-')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
  }

  return responsibility
}

/**
 * Get all variants of a responsibility value (both kebab-case and display format)
 */
export function getAllVariants(responsibility: string): string[] {
  const variants = new Set<string>()
  if (!responsibility) return []

  variants.add(responsibility)

  const kebab = toKebabCase(responsibility)
  if (kebab && kebab !== responsibility) variants.add(kebab)

  // Add shared label if kebab is shared
  if (kebab === SHARED_KEBAB.incPharmacist) variants.add(SHARED_LABELS.incPharmacist)
  if (kebab === SHARED_KEBAB.excPharmacist) variants.add(SHARED_LABELS.excPharmacist)

  return Array.from(variants)
}

/**
 * Get all shared responsibility options in both formats
 */
export function getSharedOptions(): string[] {
  return [
    SHARED_KEBAB.incPharmacist,
    SHARED_KEBAB.excPharmacist,
    SHARED_LABELS.incPharmacist,
    SHARED_LABELS.excPharmacist,
  ]
}

/**
 * Get all responsibility search options for a given role
 */
export function getSearchOptions(role: string): string[] {
  return [...getAllVariants(role), ...getSharedOptions()]
}

/**
 * Check if a role is a pharmacist role (by slug)
 */
export function isPharmacistRole(role: string): boolean {
  const normalized = toKebabCase(role)
  return normalized === 'pharmacist-primary' || normalized === 'pharmacist-supporting'
}

/**
 * Filter tasks based on responsibility rules
 */
export function filterTasksByResponsibility<T extends { responsibility: string[] }>(
  tasks: T[],
  role: string
): T[] {
  return tasks.filter(task => {
    // Direct assignment: any variant match
    const roleVariants = getAllVariants(role)
    for (const rv of roleVariants) {
      if (task.responsibility.includes(rv)) return true
    }

    // Shared handling
    const pharmacistRole = isPharmacistRole(role)

    // Shared including pharmacists -> only pharmacist roles see it
    if (
      task.responsibility.includes(SHARED_KEBAB.incPharmacist) ||
      task.responsibility.includes(SHARED_LABELS.incPharmacist)
    ) {
      return pharmacistRole
    }

    // Shared excluding pharmacists -> non-pharmacist roles only
    if (
      task.responsibility.includes(SHARED_KEBAB.excPharmacist) ||
      task.responsibility.includes(SHARED_LABELS.excPharmacist)
    ) {
      return !pharmacistRole
    }

    return false
  })
}