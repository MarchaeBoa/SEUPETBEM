/**
 * PetCare Pro - SaaS
 * Servidor Express que serve landing page, páginas de auth, dashboard e API REST.
 */
require('dotenv').config();
const path = require('path');
const express = require('express');

// Cliente libsql (Turso) + função de inicialização idempotente do schema.
const { init: initDb } = require('./db');

const authRoutes = require('./routes/auth');
const clientRoutes = require('./routes/clients');
const petRoutes = require('./routes/pets');
const appointmentRoutes = require('./routes/appointments');
const dashboardRoutes = require('./routes/dashboard');
const waitlistRoutes = require('./routes/waitlist');
const financeRoutes = require('./routes/finances');
const aiRoutes = require('./routes/ai');
const demoRequestRoutes = require('./routes/demoRequests');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Arquivos estáticos — `extensions: ['html']` permite que URLs limpas
// (sem `.html`) sejam resolvidas automaticamente: /dashboard → dashboard.html
app.use(
  express.static(path.join(__dirname, 'public'), {
    extensions: ['html'],
  })
);

// Garante que o schema do banco existe antes de atender qualquer rota de API.
// Em serverless (cold start) `initDb()` roda apenas na primeira invocação —
// chamadas seguintes reutilizam a mesma Promise (memoizada em db.js).
app.use('/api', (req, res, next) => {
  initDb().then(() => next()).catch(next);
});

// API
app.use('/api/auth', authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/pets', petRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/waitlist', waitlistRoutes);
app.use('/api/finances', financeRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/demo-requests', demoRequestRoutes);

// Healthcheck
app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'petcare-pro' }));

// Fallback 404 para /api
app.use('/api', (_req, res) => res.status(404).json({ error: 'Rota não encontrada' }));

// ───────── Rotas de página (URLs limpas) ─────────
// O dashboard existe em /public/dashboard.html — expomos rotas canônicas
// para que /dashboard, /app e /painel funcionem da mesma forma.
const sendPage = (file) => (_req, res) =>
  res.sendFile(path.join(__dirname, 'public', file));

app.get(['/dashboard', '/app', '/painel'], sendPage('dashboard.html'));
app.get('/login', sendPage('login.html'));
// /signup agora é "Agendar demonstração" — mantemos /cadastro e /demo
// como aliases para compatibilidade com campanhas antigas.
app.get(['/signup', '/cadastro', '/demo', '/agendar-demonstracao'], sendPage('signup.html'));
app.get('/acesso-restrito', sendPage('acesso-restrito.html'));

// Páginas legais (Termos, Privacidade, LGPD)
app.get('/termos', sendPage('termos.html'));
app.get(['/privacidade', '/politica-de-privacidade'], sendPage('privacidade.html'));
app.get('/lgpd', sendPage('lgpd.html'));

// Página de obrigado — destino do formulário de lista de espera e do
// cadastro. É aqui que o GTM dispara o evento de conversão `lead_submit`
// / `sign_up`, então manter uma URL dedicada e estável é importante.
app.get(['/obrigado', '/thank-you'], sendPage('obrigado.html'));

// Tratamento global de erros
app.use((err, _req, res, _next) => {
  console.error('[error]', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

// Em ambientes serverless (Vercel) não chamamos listen — o runtime
// invoca o app exportado como handler. Localmente, sobe o servidor normalmente.
if (!process.env.VERCEL) {
  app.listen(PORT, HOST, () => {
    const displayHost = HOST === '0.0.0.0' ? 'localhost' : HOST;
    console.log(`PetCare Pro rodando em http://${displayHost}:${PORT}`);
    console.log(`Abra http://${displayHost}:${PORT}/login para acessar`);
  });
}

module.exports = app;
