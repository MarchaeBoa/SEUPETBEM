# SeuPetBem

SaaS multi-tenant de gestão para clínicas veterinárias, pet shops e hoteleiras.

Stack:

- **Next.js 14** (App Router) + **TypeScript**
- **Tailwind CSS** + **shadcn/ui** (primitivos prontos em `components/ui/`)
- **Supabase** (auth + Postgres + RLS) via `@supabase/auth-helpers-nextjs`
- **react-hook-form** + **zod** para formulários
- **date-fns** para formatação de datas (locale pt-BR)
- **lucide-react** para ícones

> A versão anterior em Express + libSQL (Turso) foi preservada em
> [`legacy/`](./legacy) apenas como referência — não é usada pelo app Next.js.

## Rodando localmente

Pré-requisitos: **Node.js 18.17+**.

```bash
# 1. Instalar dependências
npm install

# 2. Copiar variáveis de ambiente e preencher com suas credenciais
cp .env.example .env.local

# 3. Rodar em modo dev
npm run dev
```

A aplicação sobe em `http://localhost:3000`.

Scripts disponíveis:

| Script            | O que faz                                  |
|-------------------|--------------------------------------------|
| `npm run dev`     | Next dev server com hot reload             |
| `npm run build`   | Build de produção (`.next/`)               |
| `npm start`       | Serve o build de produção                  |
| `npm run lint`    | ESLint (config `next/core-web-vitals`)     |
| `npm run typecheck` | `tsc --noEmit` (checa tipos sem emitir)  |

## Variáveis de ambiente

Todas as variáveis obrigatórias estão documentadas em
[`.env.example`](./.env.example). As principais:

- `NEXT_PUBLIC_SUPABASE_URL` — URL do projeto Supabase
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — chave pública (anon) protegida por RLS
- `SUPABASE_SERVICE_ROLE_KEY` — chave de serviço, **nunca exposta no browser**
- `NEXT_PUBLIC_APP_URL` — URL pública do app (redirects de auth, e-mails, etc.)

## Estrutura de pastas

```
SEUPETBEM/
├── app/                        # App Router
│   ├── layout.tsx              # Root layout (html + body)
│   ├── page.tsx                # Landing page pública
│   ├── globals.css             # Tailwind base + variáveis shadcn/ui
│   ├── (auth)/                 # Route group — layout de autenticação
│   │   ├── layout.tsx
│   │   ├── login/page.tsx
│   │   ├── signup/page.tsx
│   │   └── recuperar-senha/page.tsx
│   └── (dashboard)/            # Route group — área logada
│       ├── layout.tsx          # Sidebar + header do painel
│       └── dashboard/page.tsx  # Visão geral (KPIs)
│
├── components/                 # Componentes reutilizáveis
│   └── ui/                     # Primitivos shadcn/ui (button, input, label)
│
├── lib/                        # Utilitários e clients
│   ├── utils.ts                # cn() do shadcn/ui
│   ├── format.ts               # Formatadores pt-BR (data, moeda)
│   ├── supabase/
│   │   ├── client.ts           # Client Component Supabase client
│   │   └── server.ts           # Server Component / Route Handler client
│   └── validations/
│       └── auth.ts             # Schemas Zod de login/signup/recover
│
├── hooks/                      # Custom hooks
│   ├── use-supabase.ts
│   └── use-user.ts
│
├── types/                      # Tipos TypeScript globais
│   ├── index.ts                # Business, User, Client, Pet, Appointment
│   └── database.ts             # Tipos gerados do Supabase (placeholder)
│
├── middleware.ts               # Refresh de sessão + proteção de rotas
├── next.config.mjs
├── tailwind.config.ts
├── postcss.config.mjs
├── tsconfig.json
├── components.json             # Config do shadcn/ui CLI
├── .env.example                # Template de variáveis de ambiente
└── legacy/                     # Versão anterior (Express) — só referência
```

## Arquitetura multi-tenant

- Cada negócio (clínica, petshop, hotelzinho) é um **tenant** representado pela
  tabela `businesses` no Supabase.
- Usuários pertencem a um `business_id`. Todas as tabelas de domínio
  (`clients`, `pets`, `appointments`) carregam `business_id` e são protegidas
  por **Row Level Security (RLS)** — um usuário só consegue ler/escrever
  registros do próprio tenant.
- O cliente Supabase é criado via helpers específicos de cada contexto:
  - `lib/supabase/client.ts` → Client Components (`"use client"`)
  - `lib/supabase/server.ts` → Server Components e Route Handlers
  - `middleware.ts` → refresca a sessão e protege rotas do dashboard

## Adicionando mais componentes shadcn/ui

```bash
npx shadcn@latest add dialog
npx shadcn@latest add form
npx shadcn@latest add table
```

Os componentes são gerados em `components/ui/` e já respeitam os paths do
`components.json` e as CSS variables definidas em `app/globals.css`.
