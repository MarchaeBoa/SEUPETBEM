/**
 * /api/demo-requests
 *
 * Endpoint público que recebe o formulário "Agendar demonstração" da
 * landing page. Persiste em `demo_requests` e devolve 201 com a mensagem
 * de sucesso. A listagem e detalhe exigem autenticação (uso interno).
 */
const express = require('express');
const { db } = require('../db');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

const TIPOS_NEGOCIO = new Set([
  'clinica_veterinaria',
  'pet_shop',
  'hotel_para_pets',
  'banho_e_tosa',
  'outro',
]);

const SUCCESS_MESSAGE =
  'Recebemos seu cadastro! Nossa equipe entrará em contato em até 1 dia útil para agendar sua demonstração.';

// Normaliza strings aceitando os rótulos amigáveis do select além dos
// valores slug — mantém a API tolerante a variações do frontend.
function normalizeTipoNegocio(raw) {
  if (!raw) return null;
  const cleaned = String(raw)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  const direct = cleaned.replace(/\s+/g, '_');
  if (TIPOS_NEGOCIO.has(direct)) return direct;

  if (cleaned.includes('clinica')) return 'clinica_veterinaria';
  if (cleaned.includes('pet shop') || cleaned === 'petshop') return 'pet_shop';
  if (cleaned.includes('hotel')) return 'hotel_para_pets';
  if (cleaned.includes('banho')) return 'banho_e_tosa';
  if (cleaned.includes('outro')) return 'outro';
  return null;
}

/**
 * POST /api/demo-requests — público
 * Body: { nome, negocio, email, telefone, tipo_negocio }
 */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const nome = String(body.nome || '').trim();
    const negocio = String(body.negocio || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const telefone = String(body.telefone || '').trim();
    const tipoNegocio = normalizeTipoNegocio(body.tipo_negocio);

    if (!nome || !negocio || !email || !telefone || !tipoNegocio) {
      return res.status(400).json({
        error: 'Preencha nome, nome do negócio, email, telefone e tipo de negócio.',
      });
    }

    // Validação mínima de e-mail — evita lixo óbvio sem tentar ser RFC 5322.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Email inválido.' });
    }

    await db.execute({
      sql: `INSERT INTO demo_requests (nome, negocio, email, telefone, tipo_negocio)
            VALUES (?, ?, ?, ?, ?)`,
      args: [nome, negocio, email, telefone, tipoNegocio],
    });

    res.status(201).json({ ok: true, message: SUCCESS_MESSAGE });
  })
);

/**
 * GET /api/demo-requests — requer auth
 * Lista simples para operação interna.
 */
router.get(
  '/',
  requireAuth,
  asyncHandler(async (_req, res) => {
    const result = await db.execute({
      sql: `SELECT id, nome, negocio, email, telefone, tipo_negocio, created_at
            FROM demo_requests
            ORDER BY created_at DESC
            LIMIT 500`,
      args: [],
    });
    res.json({ items: result.rows });
  })
);

module.exports = router;
