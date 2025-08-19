/**
 * Responsibility Mapper Utility
 * 
 * This utility provides functions to map between different formats of responsibility values
 * used throughout the application, ensuring consistent handling of role-based access.
 */

// Map from display format to kebab-case
const displayToKebabMap: Record<string, string> = {
  'Pharmacist (Primary)': 'pharmacist-primary',
  'Pharmacist (Supporting)': 'pharmacist-supporting',
  'Pharmacy Assistant/s': 'pharmacy-assistants',
  'Pharmacy Assistants': 'pharmacy-assistants',
  'Dispensary Technician/s': 'dispensary-technicians',
  'Dispensary Technicians': 'dispensary-technicians',
  'DAA Packer/s': 'daa-packers',
  'DAA Packers': 'daa-packers',
  'Operational/Managerial': 'operational-managerial',
  'Shared (inc. Pharmacist)': 'shared-inc-pharmacist',
  'Shared (exc. Pharmacist)': 'shared-exc-pharmacist'
};

// Map from kebab-case to display format
const kebabToDisplayMap: Record<string, string> = {
  'pharmacist-primary': 'Pharmacist (Primary)',
  'pharmacist-supporting': 'Pharmacist (Supporting)',
  'pharmacy-assistants': 'Pharmacy Assistant/s',
  'dispensary-technicians': 'Dispensary Technician/s',
  'daa-packers': 'DAA Packer/s',
  'operational-managerial': 'Operational/Managerial',
  'shared-inc-pharmacist': 'Shared (inc. Pharmacist)',
  'shared-exc-pharmacist': 'Shared (exc. Pharmacist)'
};

/**
 * Convert a responsibility value to kebab-case format
 * 
 * @param responsibility - The responsibility value to convert
 * @returns The kebab-case version of the responsibility
 */
export function toKebabCase(responsibility: string): string {
  return displayToKebabMap[responsibility] || responsibility;
}

/**
 * Convert a responsibility value to display format
 * 
 * @param responsibility - The responsibility value to convert
 * @returns The display format version of the responsibility
 */
export function toDisplayFormat(responsibility: string): string {
  return kebabToDisplayMap[responsibility] || responsibility;
}

/**
 * Get all variants of a responsibility value (both kebab-case and display format)
 * 
 * @param responsibility - The responsibility value to get variants for
 * @returns Array of all possible variants for the responsibility
 */
export function getAllVariants(responsibility: string): string[] {
  const variants = [responsibility];
  
  // Add kebab-case variant if this is a display format
  const kebabVariant = displayToKebabMap[responsibility];
  if (kebabVariant && kebabVariant !== responsibility) {
    variants.push(kebabVariant);
  }
  
  // Add display format variant if this is a kebab-case
  const displayVariant = kebabToDisplayMap[responsibility];
  if (displayVariant && displayVariant !== responsibility) {
    variants.push(displayVariant);
  }
  
  return variants;
}

/**
 * Get all shared responsibility options in both formats
 * 
 * @returns Array of all shared responsibility options
 */
export function getSharedOptions(): string[] {
  return [
    'shared-inc-pharmacist',
    'shared-exc-pharmacist',
    'Shared (inc. Pharmacist)',
    'Shared (exc. Pharmacist)'
  ];
}

/**
 * Get all responsibility search options for a given role
 * 
 * @param role - The role to get search options for
 * @returns Array of all possible responsibility values to search for
 */
export function getSearchOptions(role: string): string[] {
  return [...getAllVariants(role), ...getSharedOptions()];
}

/**
 * Check if a role is a pharmacist role
 * 
 * @param role - The role to check
 * @returns True if the role is a pharmacist role
 */
export function isPharmacistRole(role: string): boolean {
  const normalizedRole = toKebabCase(role);
  return normalizedRole === 'pharmacist-primary' || normalizedRole === 'pharmacist-supporting';
}

/**
 * Filter tasks based on responsibility rules
 * 
 * @param tasks - Array of tasks to filter
 * @param role - The role to filter for
 * @returns Filtered array of tasks
 */
export function filterTasksByResponsibility<T extends { responsibility: string[] }>(
  tasks: T[],
  role: string
): T[] {
  return tasks.filter(task => {
    // Check if the task is directly assigned to this role (any variant)
    const roleVariants = getAllVariants(role);
    for (const roleVariant of roleVariants) {
      if (task.responsibility.includes(roleVariant)) {
        return true;
      }
    }
    
    // Handle shared responsibilities
    const pharmacistRole = isPharmacistRole(role);
    
    // If task is shared including pharmacists, only show to pharmacist roles
    if (
      task.responsibility.includes('shared-inc-pharmacist') || 
      task.responsibility.includes('Shared (inc. Pharmacist)')
    ) {
      return pharmacistRole;
    }
    
    // If task is shared excluding pharmacists, only show to non-pharmacist roles
    if (
      task.responsibility.includes('shared-exc-pharmacist') || 
      task.responsibility.includes('Shared (exc. Pharmacist)')
    ) {
      return !pharmacistRole;
    }
    
    return false;
  });
}