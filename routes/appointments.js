const express = require('express');
const { db } = require('../db');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();
router.use(requireAuth);

const VALID_STATUSES = ['agendado', 'concluido', 'cancelado'];

const toId = (v) => (typeof v === 'bigint' ? Number(v) : v);

/**
 * GET /api/appointments - lista agendamentos com dados do pet e tutor.
 * Aceita filtros ?status=&from=&to=
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { status, from, to } = req.query;
    const clauses = ['a.business_id = ?'];
    const args = [req.user.business_id];

    if (status) {
      clauses.push('a.status = ?');
      args.push(status);
    }
    if (from) {
      clauses.push('a.scheduled_at >= ?');
      args.push(from);
    }
    if (to) {
      clauses.push('a.scheduled_at <= ?');
      args.push(to);
    }

    const result = await db.execute({
      sql: `SELECT a.*, p.name AS pet_name, p.species, c.name AS client_name, c.phone AS client_phone
            FROM appointments a
            JOIN pets p ON p.id = a.pet_id
            JOIN clients c ON c.id = p.client_id
            WHERE ${clauses.join(' AND ')}
            ORDER BY a.scheduled_at ASC`,
      args,
    });

    res.json({ appointments: result.rows });
  })
);

/**
 * POST /api/appointments - cria novo agendamento.
 */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { pet_id, service, scheduled_at, price, notes } = req.body || {};
    if (!pet_id || !service || !scheduled_at) {
      return res.status(400).json({ error: 'pet_id, serviço e data são obrigatórios' });
    }

    const petResult = await db.execute({
      sql: 'SELECT id FROM pets WHERE id = ? AND business_id = ?',
      args: [pet_id, req.user.business_id],
    });
    if (petResult.rows.length === 0) {
      return res.status(400).json({ error: 'Pet inválido' });
    }

    const result = await db.execute({
      sql: `INSERT INTO appointments (business_id, pet_id, service, scheduled_at, price, notes)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [
        req.user.business_id,
        pet_id,
        service,
        scheduled_at,
        price || 0,
        notes || null,
      ],
    });

    const created = await db.execute({
      sql: 'SELECT * FROM appointments WHERE id = ?',
      args: [toId(result.lastInsertRowid)],
    });
    res.status(201).json({ appointment: created.rows[0] });
  })
);

/**
 * PUT /api/appointments/:id - atualiza agendamento (status, valor etc).
 */
router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const existingResult = await db.execute({
      sql: 'SELECT * FROM appointments WHERE id = ? AND business_id = ?',
      args: [req.params.id, req.user.business_id],
    });
    const existing = existingResult.rows[0];
    if (!existing) return res.status(404).json({ error: 'Agendamento não encontrado' });

    const { service, scheduled_at, status, price, notes } = req.body || {};
    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Status inválido' });
    }

    await db.execute({
      sql: `UPDATE appointments SET service = ?, scheduled_at = ?, status = ?, price = ?, notes = ? WHERE id = ?`,
      args: [
        service ?? existing.service,
        scheduled_at ?? existing.scheduled_at,
        status ?? existing.status,
        price ?? existing.price,
        notes ?? existing.notes,
        existing.id,
      ],
    });

    const updated = await db.execute({
      sql: 'SELECT * FROM appointments WHERE id = ?',
      args: [existing.id],
    });
    res.json({ appointment: updated.rows[0] });
  })
);

/**
 * DELETE /api/appointments/:id
 */
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const result = await db.execute({
      sql: 'DELETE FROM appointments WHERE id = ? AND business_id = ?',
      args: [req.params.id, req.user.business_id],
    });
    if (result.rowsAffected === 0) {
      return res.status(404).json({ error: 'Agendamento não encontrado' });
    }
    res.json({ success: true });
  })
);

module.exports = router;
