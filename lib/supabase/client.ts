import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import type { Database } from "@/types/database";

/**
 * Cliente Supabase para uso em Client Components ("use client").
 * Reaproveita a sessão via cookies configurada pelo auth-helpers.
 */
export function createClient() {
  return createClientComponentClient<Database>();
}
