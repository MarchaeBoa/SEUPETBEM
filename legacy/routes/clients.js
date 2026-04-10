const express = require('express');
const { db } = require('../db');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();
router.use(requireAuth);

const toId = (v) => (typeof v === 'bigint' ? Number(v) : v);

/**
 * GET /api/clients - lista clientes do business logado.
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const result = await db.execute({
      sql: `SELECT c.*, (SELECT COUNT(*) FROM pets p WHERE p.client_id = c.id) AS pet_count
            FROM clients c
            WHERE c.business_id = ?
            ORDER BY c.name ASC`,
      args: [req.user.business_id],
    });
    res.json({ clients: result.rows });
  })
);

/**
 * POST /api/clients - cria novo cliente.
 */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { name, email, phone, address } = req.body || {};
    if (!name) return res.status(400).json({ error: 'Nome é obrigatório' });

    const result = await db.execute({
      sql: 'INSERT INTO clients (business_id, name, email, phone, address) VALUES (?, ?, ?, ?, ?)',
      args: [req.user.business_id, name, email || null, phone || null, address || null],
    });

    const created = await db.execute({
      sql: 'SELECT * FROM clients WHERE id = ?',
      args: [toId(result.lastInsertRowid)],
    });
    res.status(201).json({ client: created.rows[0] });
  })
);

/**
 * PUT /api/clients/:id - atualiza cliente.
 */
router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const { name, email, phone, address } = req.body || {};
    const existingResult = await db.execute({
      sql: 'SELECT * FROM clients WHERE id = ? AND business_id = ?',
      args: [req.params.id, req.user.business_id],
    });
    const existing = existingResult.rows[0];
    if (!existing) return res.status(404).json({ error: 'Cliente não encontrado' });

    await db.execute({
      sql: 'UPDATE clients SET name = ?, email = ?, phone = ?, address = ? WHERE id = ?',
      args: [
        name ?? existing.name,
        email ?? existing.email,
        phone ?? existing.phone,
        address ?? existing.address,
        existing.id,
      ],
    });

    const updated = await db.execute({
      sql: 'SELECT * FROM clients WHERE id = ?',
      args: [existing.id],
    });
    res.json({ client: updated.rows[0] });
  })
);

/**
 * DELETE /api/clients/:id - remove cliente (e pets em cascata).
 */
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const result = await db.execute({
      sql: 'DELETE FROM clients WHERE id = ? AND business_id = ?',
      args: [req.params.id, req.user.business_id],
    });
    if (result.rowsAffected === 0) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }
    res.json({ success: true });
  })
);

module.exports = router;
