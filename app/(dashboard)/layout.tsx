import Link from "next/link";
import {
  PawPrint,
  LayoutDashboard,
  Users,
  Dog,
  CalendarDays,
  Settings,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Visão geral", icon: LayoutDashboard },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/pets", label: "Pets", icon: Dog },
  { href: "/agendamentos", label: "Agendamentos", icon: CalendarDays },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-muted/30">
      <aside className="hidden w-64 shrink-0 border-r bg-card md:block">
        <div className="flex h-16 items-center gap-2 border-b px-6">
          <PawPrint className="h-6 w-6 text-primary" />
          <span className="font-semibold">SeuPetBem</span>
        </div>
        <nav className="space-y-1 p-4">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b bg-card px-6">
          <h2 className="text-sm font-medium text-muted-foreground">
            Painel do negócio
          </h2>
          {/* TODO: menu de usuário + troca de tenant */}
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
