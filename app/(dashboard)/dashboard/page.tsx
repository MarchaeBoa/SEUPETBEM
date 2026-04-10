import { CalendarDays, Dog, Users, TrendingUp } from "lucide-react";

export const metadata = {
  title: "Visão geral — SeuPetBem",
};

const kpis = [
  { label: "Clientes ativos", value: "0", icon: Users },
  { label: "Pets cadastrados", value: "0", icon: Dog },
  { label: "Agendamentos hoje", value: "0", icon: CalendarDays },
  { label: "Receita do mês", value: "R$ 0,00", icon: TrendingUp },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Visão geral</h1>
        <p className="text-sm text-muted-foreground">
          Bem-vindo ao painel do seu negócio.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpis.map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="rounded-lg border bg-card p-6 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">
                {label}
              </p>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="mt-3 text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </div>

      {/* TODO: próximos agendamentos, últimos clientes, gráficos */}
    </div>
  );
}
