import {
  createServerComponentClient,
  createRouteHandlerClient,
} from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

/**
 * Cliente Supabase para uso em Server Components.
 * Lê a sessão do usuário a partir dos cookies da requisição.
 */
export function createServerClient() {
  return createServerComponentClient<Database>({ cookies });
}

/**
 * Cliente Supabase para uso dentro de Route Handlers (app/api/**).
 */
export function createRouteClient() {
  return createRouteHandlerClient<Database>({ cookies });
}
