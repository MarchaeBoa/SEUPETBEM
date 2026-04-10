"use client";

import { useMemo } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Hook memoizado para obter um cliente Supabase dentro de Client Components.
 * Evita recriar o cliente a cada render.
 */
export function useSupabase() {
  return useMemo(() => createClient(), []);
}
