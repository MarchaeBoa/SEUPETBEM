/**
 * Rotas da lista de espera / captura de lead de pré-lançamento.
 *
 * A proposta é honesta: o visitante informa e-mail (e opcionalmente nome,
 * negócio, telefone) e entra numa fila. Quando abrirmos novas vagas, a
 * equipe avisa. Nada aqui promete funcionalidades que ainda não existem.
 *
 * Endpoints:
 *   POST /api/waitlist            — público, cria/atualiza um lead
 *   GET  /api/waitlist            — autenticado, lista leads (painel interno)
 *   GET  /api/waitlist/stats      — autenticado, contagem total e por dia
 */
const express = require('express');
const { db } = require('../db');
const asyncHandler = require('../middleware/asyncHandler');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Regex "bom o bastante" para validação superficial de e-mail. A validação
// definitiva continua sendo double opt-in por e-mail, que cobre digitação
// correta + confirmação de posse da caixa.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MAX_LEN = {
  email: 254,
  name: 120,
  business_name: 160,
  business_type: 60,
  phone: 40,
  source: 80,
  utm: 120,
  user_agent: 500,
};

// Corta campos opcionais e retorna `null` quando o valor é vazio/inválido.
// Manter null simplifica consultas no painel.
function clean(value, maxLen) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLen);
}

// Extrai o IP do visitante levando em conta proxies (Vercel injeta
// x-forwarded-for). Guardamos apenas para auditoria/antifraude.
function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim().slice(0, 64);
  }
  return (req.ip || req.socket?.remoteAddress || '').slice(0, 64);
}

/**
 * POST /api/waitlist
 * Captura pública. Idempotente: se o e-mail já existe, atualiza os campos
 * complementares (sem sobrescrever com null) e responde 200 em vez de 201.
 */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = req.body || {};

    const email = clean(body.email, MAX_LEN.email)?.toLowerCase() || null;
    if (!email || !EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'Informe um e-mail válido' });
    }

    const name = clean(body.name, MAX_LEN.name);
    const business_name = clean(body.business_name, MAX_LEN.business_name);
    const business_type = clean(body.business_type, MAX_LEN.business_type);
    const phone = clean(body.phone, MAX_LEN.phone);
    // `source` deliberadamente não tem fallback aqui — se o cliente não
    // informou, queremos que o UPDATE use COALESCE e preserve o valor
    // existente. O fallback 'landing' só se aplica no INSERT abaixo.
    const source = clean(body.source, MAX_LEN.source);
    const utm_source = clean(body.utm_source, MAX_LEN.utm);
    const utm_medium = clean(body.utm_medium, MAX_LEN.utm);
    const utm_campaign = clean(body.utm_campaign, MAX_LEN.utm);
    const consent_marketing = body.consent_marketing ? 1 : 0;
    const ip = clientIp(req);
    const user_agent = clean(req.headers['user-agent'], MAX_LEN.user_agent);

    // Verifica se o e-mail já existe. Se sim, faz update apenas dos campos
    // não-nulos — assim um segundo envio pode complementar dados sem apagar
    // o que já veio da primeira tentativa.
    const existing = await db.execute({
      sql: 'SELECT id FROM waitlist_leads WHERE email = ?',
      args: [email],
    });

    if (existing.rows.length > 0) {
      const id = Number(existing.rows[0].id);
      await db.execute({
        sql: `UPDATE waitlist_leads
              SET name           = COALESCE(?, name),
                  business_name  = COALESCE(?, business_name),
                  business_type  = COALESCE(?, business_type),
                  phone          = COALESCE(?, phone),
                  source         = COALESCE(?, source),
                  utm_source     = COALESCE(?, utm_source),
                  utm_medium     = COALESCE(?, utm_medium),
                  utm_campaign   = COALESCE(?, utm_campaign),
                  consent_marketing = MAX(consent_marketing, ?)
              WHERE id = ?`,
        args: [
          name,
          business_name,
          business_type,
          phone,
          source,
          utm_source,
          utm_medium,
          utm_campaign,
          consent_marketing,
          id,
        ],
      });

      return res.status(200).json({
        ok: true,
        status: 'updated',
        message: 'Você já está na lista. Atualizamos seus dados.',
        id,
      });
    }

    const insert = await db.execute({
      sql: `INSERT INTO waitlist_leads
              (email, name, business_name, business_type, phone, source,
               utm_source, utm_medium, utm_campaign, ip, user_agent, consent_marketing)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        email,
        name,
        business_name,
        business_type,
        phone,
        source || 'landing', // fallback só no INSERT — ver nota acima.
        utm_source,
        utm_medium,
        utm_campaign,
        ip,
        user_agent,
        consent_marketing,
      ],
    });

    const id = typeof insert.lastInsertRowid === 'bigint'
      ? Number(insert.lastInsertRowid)
      : insert.lastInsertRowid;

    res.status(201).json({
      ok: true,
      status: 'created',
      message: 'Pronto! Você entrou na lista de espera.',
      id,
    });
  })
);

/**
 * GET /api/waitlist
 * Painel interno — lista os leads. Exige autenticação (qualquer usuário
 * autenticado pode ver, pois a waitlist é um recurso global do produto,
 * não por tenant).
 */
router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

    const result = await db.execute({
      sql: `SELECT id, email, name, business_name, business_type, phone,
                   source, utm_source, utm_medium, utm_campaign,
                   consent_marketing, created_at
            FROM waitlist_leads
            ORDER BY datetime(created_at) DESC
            LIMIT ? OFFSET ?`,
      args: [limit, offset],
    });

    const total = await db.execute('SELECT COUNT(*) AS c FROM waitlist_leads');

    res.json({
      leads: result.rows,
      total: Number(total.rows[0]?.c || 0),
      limit,
      offset,
    });
  })
);

/**
 * GET /api/waitlist/stats
 * Agregados simples para o painel (total, últimos 7 dias, últimos 30 dias).
 */
router.get(
  '/stats',
  requireAuth,
  asyncHandler(async (_req, res) => {
    const [total, last7, last30] = await Promise.all([
      db.execute('SELECT COUNT(*) AS c FROM waitlist_leads'),
      db.execute(
        "SELECT COUNT(*) AS c FROM waitlist_leads WHERE datetime(created_at) >= datetime('now', '-7 days')"
      ),
      db.execute(
        "SELECT COUNT(*) AS c FROM waitlist_leads WHERE datetime(created_at) >= datetime('now', '-30 days')"
      ),
    ]);

    res.json({
      total: Number(total.rows[0]?.c || 0),
      last_7_days: Number(last7.rows[0]?.c || 0),
      last_30_days: Number(last30.rows[0]?.c || 0),
    });
  })
);

module.exports = router;
