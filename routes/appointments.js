const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const VALID_STATUSES = ['agendado', 'concluido', 'cancelado'];

/**
 * GET /api/appointments - lista agendamentos com dados do pet e tutor.
 * Aceita filtros ?status=&from=&to=
 */
router.get('/', (req, res) => {
  const { status, from, to } = req.query;
  const clauses = ['a.business_id = ?'];
  const params = [req.user.business_id];

  if (status) {
    clauses.push('a.status = ?');
    params.push(status);
  }
  if (from) {
    clauses.push('a.scheduled_at >= ?');
    params.push(from);
  }
  if (to) {
    clauses.push('a.scheduled_at <= ?');
    params.push(to);
  }

  const appointments = db
    .prepare(
      `SELECT a.*, p.name AS pet_name, p.species, c.name AS client_name, c.phone AS client_phone
       FROM appointments a
       JOIN pets p ON p.id = a.pet_id
       JOIN clients c ON c.id = p.client_id
       WHERE ${clauses.join(' AND ')}
       ORDER BY a.scheduled_at ASC`
    )
    .all(...params);

  res.json({ appointments });
});

/**
 * POST /api/appointments - cria novo agendamento.
 */
router.post('/', (req, res) => {
  const { pet_id, service, scheduled_at, price, notes } = req.body || {};
  if (!pet_id || !service || !scheduled_at) {
    return res.status(400).json({ error: 'pet_id, serviço e data são obrigatórios' });
  }

  const pet = db
    .prepare('SELECT id FROM pets WHERE id = ? AND business_id = ?')
    .get(pet_id, req.user.business_id);
  if (!pet) return res.status(400).json({ error: 'Pet inválido' });

  const result = db
    .prepare(
      `INSERT INTO appointments (business_id, pet_id, service, scheduled_at, price, notes)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      req.user.business_id,
      pet_id,
      service,
      scheduled_at,
      price || 0,
      notes || null
    );

  const appointment = db
    .prepare('SELECT * FROM appointments WHERE id = ?')
    .get(result.lastInsertRowid);
  res.status(201).json({ appointment });
});

/**
 * PUT /api/appointments/:id - atualiza agendamento (status, valor etc).
 */
router.put('/:id', (req, res) => {
  const existing = db
    .prepare('SELECT * FROM appointments WHERE id = ? AND business_id = ?')
    .get(req.params.id, req.user.business_id);
  if (!existing) return res.status(404).json({ error: 'Agendamento não encontrado' });

  const { service, scheduled_at, status, price, notes } = req.body || {};
  if (status && !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Status inválido' });
  }

  db.prepare(
    `UPDATE appointments SET service = ?, scheduled_at = ?, status = ?, price = ?, notes = ? WHERE id = ?`
  ).run(
    service ?? existing.service,
    scheduled_at ?? existing.scheduled_at,
    status ?? existing.status,
    price ?? existing.price,
    notes ?? existing.notes,
    existing.id
  );
  const appointment = db.prepare('SELECT * FROM appointments WHERE id = ?').get(existing.id);
  res.json({ appointment });
});

/**
 * DELETE /api/appointments/:id
 */
router.delete('/:id', (req, res) => {
  const result = db
    .prepare('DELETE FROM appointments WHERE id = ? AND business_id = ?')
    .run(req.params.id, req.user.business_id);
  if (result.changes === 0) return res.status(404).json({ error: 'Agendamento não encontrado' });
  res.json({ success: true });
});

module.exports = router;
