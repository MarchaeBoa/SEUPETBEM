import { z } from "zod";

/**
 * Schemas Zod compartilhados entre formulários de autenticação
 * (client components) e Route Handlers (server).
 */

export const loginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const signupSchema = z.object({
  businessName: z.string().min(2, "Informe o nome do seu negócio"),
  name: z.string().min(2, "Informe seu nome"),
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres"),
});
export type SignupInput = z.infer<typeof signupSchema>;

export const recoverPasswordSchema = z.object({
  email: z.string().email("E-mail inválido"),
});
export type RecoverPasswordInput = z.infer<typeof recoverPasswordSchema>;
