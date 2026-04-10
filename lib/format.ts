import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

/**
 * Formata uma data no padrão brasileiro (dd/MM/yyyy HH:mm).
 */
export function formatDateTime(date: Date | string | number) {
  return format(new Date(date), "dd/MM/yyyy HH:mm", { locale: ptBR });
}

/**
 * Formata apenas a data (dd/MM/yyyy).
 */
export function formatDate(date: Date | string | number) {
  return format(new Date(date), "dd/MM/yyyy", { locale: ptBR });
}

/**
 * Tempo relativo em português ("há 2 horas").
 */
export function formatRelative(date: Date | string | number) {
  return formatDistanceToNow(new Date(date), {
    addSuffix: true,
    locale: ptBR,
  });
}

/**
 * Formata número como moeda BRL (R$ 1.234,56).
 */
export function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}
