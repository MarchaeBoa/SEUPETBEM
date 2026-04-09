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

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Arquivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

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

// Tratamento global de erros
app.use((err, _req, res, _next) => {
  console.error('[error]', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

app.listen(PORT, () => {
  console.log(`PetCare Pro rodando em http://localhost:${PORT}`);
});
