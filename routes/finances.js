/**
 * Rotas de finanças — contas a pagar/receber do negócio.
 *
 * - GET  /api/finances        → lista lançamentos do mês corrente (ou filtros)
 * - GET  /api/finances/stats  → resumo financeiro (receitas, despesas, saldo)
 * - POST /api/finances        → cria lançamento
 * - PUT  /api/finances/:id    → atualiza (principalmente marcar como pago)
 * - DELETE /api/finances/:id  → remove
 */
const express = require('express');
const { db } = require('../db');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();
router.use(requireAuth);

const toId = (v) => (typeof v === 'bigint' ? Number(v) : v);

/**
 * GET /api/finances — lista lançamentos financeiros do business.
 * Aceita ?type=receita|despesa e ?paid=0|1 como filtros opcionais.
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const bid = req.user.business_id;
    const clauses = ['business_id = ?'];
    const args = [bid];

    if (req.query.type === 'receita' || req.query.type === 'despesa') {
      clauses.push('type = ?');
      args.push(req.query.type);
    }
    if (req.query.paid === '0' || req.query.paid === '1') {
      clauses.push('paid = ?');
      args.push(Number(req.query.paid));
    }

    const result = await db.execute({
      sql: `SELECT * FROM finances
            WHERE ${clauses.join(' AND ')}
            ORDER BY COALESCE(due_date, created_at) DESC, id DESC
            LIMIT 500`,
      args,
    });
    res.json({ finances: result.rows });
  })
);

/**
 * GET /api/finances/stats — totais do mês corrente.
 * Retorna receitas, despesas, saldo e contas vencidas/não pagas.
 */
router.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const bid = req.user.business_id;

    const [incomeR, expenseR, overdueR, upcomingR] = await Promise.all([
      db.execute({
        sql: `SELECT COALESCE(SUM(amount), 0) AS total FROM finances
              WHERE business_id = ? AND type = 'receita'
                AND COALESCE(due_date, created_at) >= datetime('now', 'start of month')`,
        args: [bid],
      }),
      db.execute({
        sql: `SELECT COALESCE(SUM(amount), 0) AS total FROM finances
              WHERE business_id = ? AND type = 'despesa'
                AND COALESCE(due_date, created_at) >= datetime('now', 'start of month')`,
        args: [bid],
      }),
      db.execute({
        sql: `SELECT COUNT(*) AS n, COALESCE(SUM(amount), 0) AS total FROM finances
              WHERE business_id = ? AND paid = 0
                AND due_date IS NOT NULL AND due_date < datetime('now')`,
        args: [bid],
      }),
      db.execute({
        sql: `SELECT id, description, amount, due_date, type FROM finances
              WHERE business_id = ? AND paid = 0
                AND due_date IS NOT NULL AND due_date >= datetime('now')
              ORDER BY due_date ASC
              LIMIT 5`,
        args: [bid],
      }),
    ]);

    const month_income = Number(incomeR.rows[0].total) || 0;
    const month_expense = Number(expenseR.rows[0].total) || 0;

    res.json({
      stats: {
        month_income,
        month_expense,
        month_balance: month_income - month_expense,
        overdue_count: overdueR.rows[0].n,
        overdue_total: Number(overdueR.rows[0].total) || 0,
      },
      upcoming: upcomingR.rows,
    });
  })
);

/**
 * POST /api/finances — cria lançamento financeiro.
 */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { type, category, description, amount, due_date, paid, notes } = req.body || {};

    if (type !== 'receita' && type !== 'despesa') {
      return res.status(400).json({ error: 'Tipo deve ser "receita" ou "despesa"' });
    }
    if (!description || !String(description).trim()) {
      return res.status(400).json({ error: 'Descrição é obrigatória' });
    }
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      return res.status(400).json({ error: 'Valor deve ser maior que zero' });
    }

    const result = await db.execute({
      sql: `INSERT INTO finances
              (business_id, type, category, description, amount, due_date, paid, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        req.user.business_id,
        type,
        category || null,
        String(description).trim(),
        amt,
        due_date || null,
        paid ? 1 : 0,
        notes || null,
      ],
    });

    const created = await db.execute({
      sql: 'SELECT * FROM finances WHERE id = ?',
      args: [toId(result.lastInsertRowid)],
    });
    res.status(201).json({ finance: created.rows[0] });
  })
);

/**
 * PUT /api/finances/:id — atualiza lançamento.
 */
router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const existingResult = await db.execute({
      sql: 'SELECT * FROM finances WHERE id = ? AND business_id = ?',
      args: [req.params.id, req.user.business_id],
    });
    const existing = existingResult.rows[0];
    if (!existing) return res.status(404).json({ error: 'Lançamento não encontrado' });

    const { type, category, description, amount, due_date, paid, notes } = req.body || {};

    await db.execute({
      sql: `UPDATE finances
            SET type = ?, category = ?, description = ?, amount = ?,
                due_date = ?, paid = ?, notes = ?
            WHERE id = ?`,
      args: [
        type === 'receita' || type === 'despesa' ? type : existing.type,
        category ?? existing.category,
        description ?? existing.description,
        amount != null ? Number(amount) : existing.amount,
        due_date ?? existing.due_date,
        paid != null ? (paid ? 1 : 0) : existing.paid,
        notes ?? existing.notes,
        existing.id,
      ],
    });

    const updated = await db.execute({
      sql: 'SELECT * FROM finances WHERE id = ?',
      args: [existing.id],
    });
    res.json({ finance: updated.rows[0] });
  })
);

/**
 * DELETE /api/finances/:id — remove lançamento.
 */
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const result = await db.execute({
      sql: 'DELETE FROM finances WHERE id = ? AND business_id = ?',
      args: [req.params.id, req.user.business_id],
    });
    if (result.rowsAffected === 0) {
      return res.status(404).json({ error: 'Lançamento não encontrado' });
    }
    res.json({ success: true });
  })
);

module.exports = router;
