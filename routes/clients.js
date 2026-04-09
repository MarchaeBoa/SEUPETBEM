const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

/**
 * GET /api/clients - lista clientes do business logado.
 */
router.get('/', (req, res) => {
  const clients = db
    .prepare(
      `SELECT c.*, (SELECT COUNT(*) FROM pets p WHERE p.client_id = c.id) AS pet_count
       FROM clients c
       WHERE c.business_id = ?
       ORDER BY c.name ASC`
    )
    .all(req.user.business_id);
  res.json({ clients });
});

/**
 * POST /api/clients - cria novo cliente.
 */
router.post('/', (req, res) => {
  const { name, email, phone, address } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Nome é obrigatório' });

  const result = db
    .prepare(
      'INSERT INTO clients (business_id, name, email, phone, address) VALUES (?, ?, ?, ?, ?)'
    )
    .run(req.user.business_id, name, email || null, phone || null, address || null);

  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ client });
});

/**
 * PUT /api/clients/:id - atualiza cliente.
 */
router.put('/:id', (req, res) => {
  const { name, email, phone, address } = req.body || {};
  const existing = db
    .prepare('SELECT * FROM clients WHERE id = ? AND business_id = ?')
    .get(req.params.id, req.user.business_id);
  if (!existing) return res.status(404).json({ error: 'Cliente não encontrado' });

  db.prepare(
    `UPDATE clients SET name = ?, email = ?, phone = ?, address = ? WHERE id = ?`
  ).run(
    name ?? existing.name,
    email ?? existing.email,
    phone ?? existing.phone,
    address ?? existing.address,
    existing.id
  );

  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(existing.id);
  res.json({ client });
});

/**
 * DELETE /api/clients/:id - remove cliente (e pets em cascata).
 */
router.delete('/:id', (req, res) => {
  const result = db
    .prepare('DELETE FROM clients WHERE id = ? AND business_id = ?')
    .run(req.params.id, req.user.business_id);
  if (result.changes === 0) return res.status(404).json({ error: 'Cliente não encontrado' });
  res.json({ success: true });
});

module.exports = router;
