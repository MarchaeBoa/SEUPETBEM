import Link from "next/link";
import { PawPrint } from "lucide-react";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <div className="flex items-center gap-3">
        <PawPrint className="h-10 w-10 text-primary" />
        <h1 className="text-4xl font-bold tracking-tight">SeuPetBem</h1>
      </div>
      <p className="max-w-xl text-center text-lg text-muted-foreground">
        SaaS multi-tenant de gestão para clínicas veterinárias, pet shops e
        hoteleiras.
      </p>
      <div className="flex gap-4">
        <Link
          href="/login"
          className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Entrar
        </Link>
        <Link
          href="/signup"
          className="rounded-md border border-input bg-background px-6 py-2 text-sm font-medium hover:bg-accent"
        >
          Criar conta
        </Link>
      </div>
    </main>
  );
}
