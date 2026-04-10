/**
 * Tipos globais de domínio (multi-tenant petshop).
 *
 * Cada registro pertence a um `business_id` (tenant). Rotas e queries
 * devem sempre filtrar por este campo + RLS no Supabase.
 */

export type BusinessType = "clinica" | "petshop" | "hotel";

export interface Business {
  id: string;
  name: string;
  type: BusinessType;
  created_at: string;
}

export interface User {
  id: string;
  business_id: string;
  name: string;
  email: string;
  role: "owner" | "admin" | "staff";
  created_at: string;
}

export interface Client {
  id: string;
  business_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  created_at: string;
}

export interface Pet {
  id: string;
  business_id: string;
  client_id: string;
  name: string;
  species: string;
  breed: string | null;
  birth_date: string | null;
  created_at: string;
}

export type AppointmentStatus = "agendado" | "concluido" | "cancelado";

export interface Appointment {
  id: string;
  business_id: string;
  pet_id: string;
  starts_at: string;
  ends_at: string | null;
  status: AppointmentStatus;
  notes: string | null;
  created_at: string;
}
