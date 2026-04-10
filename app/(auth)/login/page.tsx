import Link from "next/link";

export const metadata = {
  title: "Entrar — SeuPetBem",
};

export default function LoginPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Entrar</h1>
        <p className="text-sm text-muted-foreground">
          Acesse sua conta para gerenciar seu petshop.
        </p>
      </div>

      {/* TODO: formulário de login com react-hook-form + zod + Supabase auth */}
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
        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium">
            Senha
          </label>
          <input
            id="password"
            type="password"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          className="h-10 w-full rounded-md bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Entrar
        </button>
      </form>

      <div className="flex items-center justify-between text-sm">
        <Link
          href="/recuperar-senha"
          className="text-muted-foreground hover:text-foreground"
        >
          Esqueci minha senha
        </Link>
        <Link href="/signup" className="font-medium hover:underline">
          Criar conta
        </Link>
      </div>
    </div>
  );
}
