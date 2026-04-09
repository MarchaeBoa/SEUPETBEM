const express = require('express');
const { db } = require('../db');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();
router.use(requireAuth);

const toId = (v) => (typeof v === 'bigint' ? Number(v) : v);

/**
 * GET /api/pets - lista pets com nome do tutor.
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const result = await db.execute({
      sql: `SELECT p.*, c.name AS client_name
            FROM pets p
            JOIN clients c ON c.id = p.client_id
            WHERE p.business_id = ?
            ORDER BY p.name ASC`,
      args: [req.user.business_id],
    });
    res.json({ pets: result.rows });
  })
);

/**
 * POST /api/pets - cria pet vinculado a um cliente.
 */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { client_id, name, species, breed, birth_date, weight, notes } = req.body || {};
    if (!client_id || !name || !species) {
      return res.status(400).json({ error: 'client_id, nome e espécie são obrigatórios' });
    }

    // Garante que o cliente pertence ao mesmo business
    const clientResult = await db.execute({
      sql: 'SELECT id FROM clients WHERE id = ? AND business_id = ?',
      args: [client_id, req.user.business_id],
    });
    if (clientResult.rows.length === 0) {
      return res.status(400).json({ error: 'Cliente inválido' });
    }

    const result = await db.execute({
      sql: `INSERT INTO pets (business_id, client_id, name, species, breed, birth_date, weight, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        req.user.business_id,
        client_id,
        name,
        species,
        breed || null,
        birth_date || null,
        weight || null,
        notes || null,
      ],
    });

    const created = await db.execute({
      sql: 'SELECT * FROM pets WHERE id = ?',
      args: [toId(result.lastInsertRowid)],
    });
    res.status(201).json({ pet: created.rows[0] });
  })
);

/**
 * PUT /api/pets/:id - atualiza pet.
 */
router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const existingResult = await db.execute({
      sql: 'SELECT * FROM pets WHERE id = ? AND business_id = ?',
      args: [req.params.id, req.user.business_id],
    });
    const existing = existingResult.rows[0];
    if (!existing) return res.status(404).json({ error: 'Pet não encontrado' });

    const { name, species, breed, birth_date, weight, notes } = req.body || {};
    await db.execute({
      sql: `UPDATE pets SET name = ?, species = ?, breed = ?, birth_date = ?, weight = ?, notes = ? WHERE id = ?`,
      args: [
        name ?? existing.name,
        species ?? existing.species,
        breed ?? existing.breed,
        birth_date ?? existing.birth_date,
        weight ?? existing.weight,
        notes ?? existing.notes,
        existing.id,
      ],
    });

    const updated = await db.execute({
      sql: 'SELECT * FROM pets WHERE id = ?',
      args: [existing.id],
    });
    res.json({ pet: updated.rows[0] });
  })
);

/**
 * DELETE /api/pets/:id
 */
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const result = await db.execute({
      sql: 'DELETE FROM pets WHERE id = ? AND business_id = ?',
      args: [req.params.id, req.user.business_id],
    });
    if (result.rowsAffected === 0) {
      return res.status(404).json({ error: 'Pet não encontrado' });
    }
    res.json({ success: true });
  })
);

module.exports = router;
