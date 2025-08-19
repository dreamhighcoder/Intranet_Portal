// Global type declarations

interface WindowEventMap {
  'open-checklist-login': CustomEvent<{ positionId: string; roleDisplayName: string }>;
  'positions-updated': CustomEvent;
}