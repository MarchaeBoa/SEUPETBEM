/**
 * Tipos do banco de dados Supabase.
 *
 * Para gerar automaticamente a partir do schema real:
 *   npx supabase gen types typescript --project-id <seu-id> > types/database.ts
 *
 * Enquanto o schema não está pronto, exportamos um placeholder permissivo
 * para que os clients do Supabase funcionem sem type errors.
 */
export type Database = {
  public: {
    Tables: Record<string, { Row: Record<string, unknown> }>;
    Views: Record<string, { Row: Record<string, unknown> }>;
    Functions: Record<string, unknown>;
    Enums: Record<string, string>;
  };
};
