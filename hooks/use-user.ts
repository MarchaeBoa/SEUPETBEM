"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { useSupabase } from "./use-supabase";

/**
 * Hook que expõe o usuário autenticado atual e reage a mudanças de sessão.
 * Retorna `null` enquanto carrega.
 */
export function useUser() {
  const supabase = useSupabase();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      setUser(data.user ?? null);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      },
    );

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  return { user, loading };
}
