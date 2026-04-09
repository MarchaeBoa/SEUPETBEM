const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

/**
 * GET /api/pets - lista pets com nome do tutor.
 */
router.get('/', (req, res) => {
  const pets = db
    .prepare(
      `SELECT p.*, c.name AS client_name
       FROM pets p
       JOIN clients c ON c.id = p.client_id
       WHERE p.business_id = ?
       ORDER BY p.name ASC`
    )
    .all(req.user.business_id);
  res.json({ pets });
});

/**
 * POST /api/pets - cria pet vinculado a um cliente.
 */
router.post('/', (req, res) => {
  const { client_id, name, species, breed, birth_date, weight, notes } = req.body || {};
  if (!client_id || !name || !species) {
    return res.status(400).json({ error: 'client_id, nome e espécie são obrigatórios' });
  }

  // Garante que o cliente pertence ao mesmo business
  const client = db
    .prepare('SELECT id FROM clients WHERE id = ? AND business_id = ?')
    .get(client_id, req.user.business_id);
  if (!client) return res.status(400).json({ error: 'Cliente inválido' });

  const result = db
    .prepare(
      `INSERT INTO pets (business_id, client_id, name, species, breed, birth_date, weight, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      req.user.business_id,
      client_id,
      name,
      species,
      breed || null,
      birth_date || null,
      weight || null,
      notes || null
    );

  const pet = db.prepare('SELECT * FROM pets WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ pet });
});

/**
 * PUT /api/pets/:id - atualiza pet.
 */
router.put('/:id', (req, res) => {
  const existing = db
    .prepare('SELECT * FROM pets WHERE id = ? AND business_id = ?')
    .get(req.params.id, req.user.business_id);
  if (!existing) return res.status(404).json({ error: 'Pet não encontrado' });

  const { name, species, breed, birth_date, weight, notes } = req.body || {};
  db.prepare(
    `UPDATE pets SET name = ?, species = ?, breed = ?, birth_date = ?, weight = ?, notes = ? WHERE id = ?`
  ).run(
    name ?? existing.name,
    species ?? existing.species,
    breed ?? existing.breed,
    birth_date ?? existing.birth_date,
    weight ?? existing.weight,
    notes ?? existing.notes,
    existing.id
  );
  const pet = db.prepare('SELECT * FROM pets WHERE id = ?').get(existing.id);
  res.json({ pet });
});

/**
 * DELETE /api/pets/:id
 */
router.delete('/:id', (req, res) => {
  const result = db
    .prepare('DELETE FROM pets WHERE id = ? AND business_id = ?')
    .run(req.params.id, req.user.business_id);
  if (result.changes === 0) return res.status(404).json({ error: 'Pet não encontrado' });
  res.json({ success: true });
});

module.exports = router;
