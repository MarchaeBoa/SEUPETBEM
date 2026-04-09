# PetCare Pro

SaaS completa para clínicas veterinárias, pet shops e hoteleiras.
Stack simples e funcional: **Node.js + Express + Turso (libSQL) + HTML/CSS/JS vanilla**.

## Funcionalidades

- Landing page com planos, depoimentos e CTAs
- Cadastro e login com JWT (bcrypt para hash de senha)
- Arquitetura **multi-tenant**: cada negócio vê apenas seus próprios dados
- Painel com visão geral (KPIs) e próximos agendamentos
- CRUD de **clientes (tutores)**
- CRUD de **pets** vinculados ao tutor
- CRUD de **agendamentos** com status (agendado / concluído / cancelado)
- API REST JSON completa

## Rodando localmente

Pré-requisitos: **Node.js 18+**.

```bash
# 1. Instalar dependências
npm install

# 2. Copiar o .env de exemplo e ajustar a JWT_SECRET
cp .env.example .env

# 3. Iniciar o servidor
npm start
```

A aplicação sobe em `http://localhost:3000`.

- Landing: `/`
- Cadastro: `/signup.html`
- Login: `/login.html`
- Painel: `/dashboard.html`

Por padrão, em desenvolvimento o banco é um arquivo libSQL local criado
automaticamente em `./data/petcare.db` na primeira execução (a pasta `data/`
está ignorada pelo git).

## Banco de dados — Turso (produção)

O projeto usa [`@libsql/client`](https://github.com/tursodatabase/libsql-client-ts),
o driver oficial do Turso (SQLite distribuído e gerenciado na nuvem). A mesma
base de código roda contra um arquivo local em dev e contra um banco Turso em
produção — basta trocar variáveis de ambiente.

### Passo a passo

1. Crie um banco gratuito em [turso.tech](https://turso.tech) e gere um auth
   token.
2. No **Vercel Dashboard → Settings → Environment Variables**, adicione:
   - `TURSO_DATABASE_URL` (ex.: `libsql://seu-banco.turso.io`)
   - `TURSO_AUTH_TOKEN` (o token gerado)
   - `JWT_SECRET` (chave aleatória para assinar JWTs)
3. Faça o deploy — o schema (`businesses`, `users`, `clients`, `pets`,
   `appointments`) é criado automaticamente na primeira requisição via
   `CREATE TABLE IF NOT EXISTS`.

Se `TURSO_DATABASE_URL` não estiver definida, o app cai no arquivo local
`file:./data/petcare.db`, o que mantém `npm start` funcionando sem
dependências externas.

## Estrutura

```
SEUPETBEM/
├── server.js              # Express app + rotas
├── db.js                  # Cliente libSQL (Turso) + schema
├── middleware/
│   ├── auth.js            # JWT + bcrypt
│   └── asyncHandler.js    # Wrapper para handlers async
├── routes/
│   ├── auth.js            # signup, login, me
│   ├── clients.js         # CRUD de clientes
│   ├── pets.js            # CRUD de pets
│   ├── appointments.js    # CRUD de agendamentos
│   └── dashboard.js       # métricas agregadas
├── public/                # Frontend estático
│   ├── index.html         # Landing page
│   ├── login.html
│   ├── signup.html
│   ├── dashboard.html     # SPA do painel
│   ├── css/
│   │   ├── landing.css
│   │   ├── auth.css
│   │   └── app.css
│   └── js/
│       ├── auth.js
│       └── dashboard.js
├── package.json
├── .env.example
└── .gitignore
```

## API

Todas as rotas (exceto `/api/auth/signup` e `/api/auth/login`) exigem o header
`Authorization: Bearer <token>`.

### Autenticação

| Método | Rota                 | Body                                                  |
|--------|----------------------|-------------------------------------------------------|
| POST   | `/api/auth/signup`   | `{ name, email, password, business_name }`           |
| POST   | `/api/auth/login`    | `{ email, password }`                                 |
| GET    | `/api/auth/me`       | –                                                     |

### Recursos

| Método | Rota                        | Descrição                    |
|--------|-----------------------------|------------------------------|
| GET    | `/api/clients`              | Lista clientes               |
| POST   | `/api/clients`              | Cria cliente                 |
| PUT    | `/api/clients/:id`          | Atualiza cliente             |
| DELETE | `/api/clients/:id`          | Remove cliente               |
| GET    | `/api/pets`                 | Lista pets                   |
| POST   | `/api/pets`                 | Cria pet                     |
| PUT    | `/api/pets/:id`             | Atualiza pet                 |
| DELETE | `/api/pets/:id`             | Remove pet                   |
| GET    | `/api/appointments`         | Lista agendamentos           |
| POST   | `/api/appointments`         | Cria agendamento             |
| PUT    | `/api/appointments/:id`     | Atualiza agendamento         |
| DELETE | `/api/appointments/:id`     | Remove agendamento           |
| GET    | `/api/dashboard/stats`      | KPIs + próximos agendamentos |

## Próximos passos (ideias)

- Envio real de WhatsApp/E-mail para lembretes
- Assinatura de planos via Stripe/Pagar.me
- Uploads de fotos dos pets
- Convite de colaboradores (roles extras)
- Relatórios exportáveis em PDF
