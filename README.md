# PetCare Pro

SaaS completa para clínicas veterinárias, pet shops e hoteleiras.
Stack simples e funcional: **Node.js + Express + SQLite + HTML/CSS/JS vanilla**.

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

O banco SQLite é criado automaticamente em `./data/petcare.db` na primeira
execução (a pasta `data/` está ignorada pelo git).

## Estrutura

```
SEUPETBEM/
├── server.js              # Express app + rotas
├── db.js                  # SQLite + schema
├── middleware/
│   └── auth.js            # JWT + bcrypt
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
