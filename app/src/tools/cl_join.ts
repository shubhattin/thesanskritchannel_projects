import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Uses `clsx` and `tailwind-merge` to join classes
 */
export function cl_join(...args: ClassValue[]) {
  return twMerge(clsx(args));
}
