const express = require('express');
const { query, queryOne } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

/**
 * GET /api/pets - lista pets com nome do tutor.
 */
router.get('/', async (req, res, next) => {
  try {
    const pets = await query(
      `SELECT p.*, c.name AS client_name
         FROM pets p
         JOIN clients c ON c.id = p.client_id
        WHERE p.business_id = $1
        ORDER BY p.name ASC`,
      [req.user.business_id]
    );
    res.json({ pets });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/pets - cria pet vinculado a um cliente.
 */
router.post('/', async (req, res, next) => {
  try {
    const { client_id, name, species, breed, birth_date, weight, notes } = req.body || {};
    if (!client_id || !name || !species) {
      return res.status(400).json({ error: 'client_id, nome e espécie são obrigatórios' });
    }

    // Garante que o cliente pertence ao mesmo business
    const client = await queryOne(
      'SELECT id FROM clients WHERE id = $1 AND business_id = $2',
      [client_id, req.user.business_id]
    );
    if (!client) return res.status(400).json({ error: 'Cliente inválido' });

    const pet = await queryOne(
      `INSERT INTO pets (business_id, client_id, name, species, breed, birth_date, weight, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        req.user.business_id,
        client_id,
        name,
        species,
        breed || null,
        birth_date || null,
        weight || null,
        notes || null,
      ]
    );
    res.status(201).json({ pet });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/pets/:id - atualiza pet.
 */
router.put('/:id', async (req, res, next) => {
  try {
    const existing = await queryOne(
      'SELECT * FROM pets WHERE id = $1 AND business_id = $2',
      [req.params.id, req.user.business_id]
    );
    if (!existing) return res.status(404).json({ error: 'Pet não encontrado' });

    const { name, species, breed, birth_date, weight, notes } = req.body || {};
    const pet = await queryOne(
      `UPDATE pets
          SET name = $1, species = $2, breed = $3, birth_date = $4, weight = $5, notes = $6
        WHERE id = $7
       RETURNING *`,
      [
        name ?? existing.name,
        species ?? existing.species,
        breed ?? existing.breed,
        birth_date ?? existing.birth_date,
        weight ?? existing.weight,
        notes ?? existing.notes,
        existing.id,
      ]
    );
    res.json({ pet });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/pets/:id
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const deleted = await query(
      'DELETE FROM pets WHERE id = $1 AND business_id = $2 RETURNING id',
      [req.params.id, req.user.business_id]
    );
    if (deleted.length === 0) return res.status(404).json({ error: 'Pet não encontrado' });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
