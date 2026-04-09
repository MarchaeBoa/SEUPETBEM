/**
 * PetCare Pro - SaaS
 * Servidor Express que serve landing page, páginas de auth, dashboard e API REST.
 */
require('dotenv').config();
const path = require('path');
const express = require('express');

// Inicializa o banco (cria tabelas na primeira execução)
require('./db');

const authRoutes = require('./routes/auth');
const clientRoutes = require('./routes/clients');
const petRoutes = require('./routes/pets');
const appointmentRoutes = require('./routes/appointments');
const dashboardRoutes = require('./routes/dashboard');

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

// API
app.use('/api/auth', authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/pets', petRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/dashboard', dashboardRoutes);

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
app.get(['/signup', '/cadastro'], sendPage('signup.html'));

// Páginas legais (Termos, Privacidade, LGPD)
app.get('/termos', sendPage('termos.html'));
app.get(['/privacidade', '/politica-de-privacidade'], sendPage('privacidade.html'));
app.get('/lgpd', sendPage('lgpd.html'));

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
