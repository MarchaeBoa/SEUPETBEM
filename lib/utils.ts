import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Helper padrão do shadcn/ui para combinar classes Tailwind
 * respeitando precedência e condicionais.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
