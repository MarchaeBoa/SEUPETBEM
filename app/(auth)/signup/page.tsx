import Link from "next/link";

export const metadata = {
  title: "Criar conta — SeuPetBem",
};

export default function SignupPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Criar conta</h1>
        <p className="text-sm text-muted-foreground">
          Cadastre seu negócio e comece a organizar a agenda em minutos.
        </p>
      </div>

      {/* TODO: formulário de signup com react-hook-form + zod + Supabase auth */}
      <form className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="business_name" className="text-sm font-medium">
            Nome do negócio
          </label>
          <input
            id="business_name"
            type="text"
            placeholder="Clínica Pet Feliz"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="name" className="text-sm font-medium">
            Seu nome
          </label>
          <input
            id="name"
            type="text"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium">
            E-mail
          </label>
          <input
            id="email"
            type="email"
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
          Criar conta
        </button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Já possui uma conta?{" "}
        <Link href="/login" className="font-medium text-foreground hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  );
}
