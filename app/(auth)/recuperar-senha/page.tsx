import Link from "next/link";

export const metadata = {
  title: "Recuperar senha — SeuPetBem",
};

export default function RecoverPasswordPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Recuperar senha
        </h1>
        <p className="text-sm text-muted-foreground">
          Enviaremos um link de redefinição para o seu e-mail.
        </p>
      </div>

      {/* TODO: fluxo de recuperação com Supabase auth (resetPasswordForEmail) */}
      <form className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium">
            E-mail
          </label>
          <input
            id="email"
            type="email"
            placeholder="voce@exemplo.com.br"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          className="h-10 w-full rounded-md bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Enviar link de recuperação
        </button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Lembrou a senha?{" "}
        <Link href="/login" className="font-medium text-foreground hover:underline">
          Voltar ao login
        </Link>
      </p>
    </div>
  );
}
