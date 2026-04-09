const express = require('express');
const { query, queryOne } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

/**
 * GET /api/clients - lista clientes do business logado.
 */
router.get('/', async (req, res, next) => {
  try {
    const clients = await query(
      `SELECT c.*,
              (SELECT COUNT(*)::int FROM pets p WHERE p.client_id = c.id) AS pet_count
         FROM clients c
        WHERE c.business_id = $1
        ORDER BY c.name ASC`,
      [req.user.business_id]
    );
    res.json({ clients });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/clients - cria novo cliente.
 */
router.post('/', async (req, res, next) => {
  try {
    const { name, email, phone, address } = req.body || {};
    if (!name) return res.status(400).json({ error: 'Nome é obrigatório' });

    const client = await queryOne(
      `INSERT INTO clients (business_id, name, email, phone, address)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.user.business_id, name, email || null, phone || null, address || null]
    );
    res.status(201).json({ client });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/clients/:id - atualiza cliente.
 */
router.put('/:id', async (req, res, next) => {
  try {
    const { name, email, phone, address } = req.body || {};
    const existing = await queryOne(
      'SELECT * FROM clients WHERE id = $1 AND business_id = $2',
      [req.params.id, req.user.business_id]
    );
    if (!existing) return res.status(404).json({ error: 'Cliente não encontrado' });

    const client = await queryOne(
      `UPDATE clients
          SET name = $1, email = $2, phone = $3, address = $4
        WHERE id = $5
       RETURNING *`,
      [
        name ?? existing.name,
        email ?? existing.email,
        phone ?? existing.phone,
        address ?? existing.address,
        existing.id,
      ]
    );
    res.json({ client });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/clients/:id - remove cliente (e pets em cascata).
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const deleted = await query(
      'DELETE FROM clients WHERE id = $1 AND business_id = $2 RETURNING id',
      [req.params.id, req.user.business_id]
    );
    if (deleted.length === 0) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
