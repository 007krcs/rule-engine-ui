import { clsx, type ClassValue } from 'clsx';
// Intentionally avoid Tailwind-specific class merging; core UI uses first-party CSS.

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}
