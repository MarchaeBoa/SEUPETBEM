const express = require('express');
const { query, queryOne } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const VALID_STATUSES = ['agendado', 'concluido', 'cancelado'];

/**
 * GET /api/appointments - lista agendamentos com dados do pet e tutor.
 * Aceita filtros ?status=&from=&to=
 */
router.get('/', async (req, res, next) => {
  try {
    const { status, from, to } = req.query;
    const clauses = ['a.business_id = $1'];
    const params = [req.user.business_id];
    let i = 2;

    if (status) {
      clauses.push(`a.status = $${i++}`);
      params.push(status);
    }
    if (from) {
      clauses.push(`a.scheduled_at >= $${i++}::timestamptz`);
      params.push(from);
    }
    if (to) {
      clauses.push(`a.scheduled_at <= $${i++}::timestamptz`);
      params.push(to);
    }

    const appointments = await query(
      `SELECT a.*, p.name AS pet_name, p.species,
              c.name AS client_name, c.phone AS client_phone
         FROM appointments a
         JOIN pets p ON p.id = a.pet_id
         JOIN clients c ON c.id = p.client_id
        WHERE ${clauses.join(' AND ')}
        ORDER BY a.scheduled_at ASC`,
      params
    );

    res.json({ appointments });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/appointments - cria novo agendamento.
 */
router.post('/', async (req, res, next) => {
  try {
    const { pet_id, service, scheduled_at, price, notes } = req.body || {};
    if (!pet_id || !service || !scheduled_at) {
      return res.status(400).json({ error: 'pet_id, serviço e data são obrigatórios' });
    }

    const pet = await queryOne(
      'SELECT id FROM pets WHERE id = $1 AND business_id = $2',
      [pet_id, req.user.business_id]
    );
    if (!pet) return res.status(400).json({ error: 'Pet inválido' });

    const appointment = await queryOne(
      `INSERT INTO appointments (business_id, pet_id, service, scheduled_at, price, notes)
       VALUES ($1, $2, $3, $4::timestamptz, $5, $6)
       RETURNING *`,
      [
        req.user.business_id,
        pet_id,
        service,
        scheduled_at,
        price || 0,
        notes || null,
      ]
    );
    res.status(201).json({ appointment });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/appointments/:id - atualiza agendamento (status, valor etc).
 */
router.put('/:id', async (req, res, next) => {
  try {
    const existing = await queryOne(
      'SELECT * FROM appointments WHERE id = $1 AND business_id = $2',
      [req.params.id, req.user.business_id]
    );
    if (!existing) return res.status(404).json({ error: 'Agendamento não encontrado' });

    const { service, scheduled_at, status, price, notes } = req.body || {};
    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Status inválido' });
    }

    const appointment = await queryOne(
      `UPDATE appointments
          SET service = $1,
              scheduled_at = $2::timestamptz,
              status = $3,
              price = $4,
              notes = $5
        WHERE id = $6
       RETURNING *`,
      [
        service ?? existing.service,
        scheduled_at ?? existing.scheduled_at,
        status ?? existing.status,
        price ?? existing.price,
        notes ?? existing.notes,
        existing.id,
      ]
    );
    res.json({ appointment });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/appointments/:id
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const deleted = await query(
      'DELETE FROM appointments WHERE id = $1 AND business_id = $2 RETURNING id',
      [req.params.id, req.user.business_id]
    );
    if (deleted.length === 0) {
      return res.status(404).json({ error: 'Agendamento não encontrado' });
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
