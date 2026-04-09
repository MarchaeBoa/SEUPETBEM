const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../db');
const { signToken, requireAuth } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

// libsql retorna `lastInsertRowid` como BigInt. Convertemos para Number
// antes de usar em respostas JSON e em outras queries.
const toId = (v) => (typeof v === 'bigint' ? Number(v) : v);

/**
 * POST /api/auth/signup
 * Cria um novo business e seu usuário owner.
 */
router.post(
  '/signup',
  asyncHandler(async (req, res) => {
    const { name, email, password, business_name } = req.body || {};

    if (!name || !email || !password || !business_name) {
      return res.status(400).json({ error: 'Preencha nome, email, senha e nome do negócio' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres' });
    }

    const existing = await db.execute({
      sql: 'SELECT id FROM users WHERE email = ?',
      args: [email.toLowerCase()],
    });
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email já cadastrado' });
    }

    const hash = bcrypt.hashSync(password, 10);

    // Transação garante que business + user são criados atomicamente.
    const tx = await db.transaction('write');
    let businessId;
    let userId;
    try {
      const bizResult = await tx.execute({
        sql: 'INSERT INTO businesses (name, plan) VALUES (?, ?)',
        args: [business_name, 'starter'],
      });
      businessId = toId(bizResult.lastInsertRowid);

      const userResult = await tx.execute({
        sql: 'INSERT INTO users (business_id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)',
        args: [businessId, name, email.toLowerCase(), hash, 'owner'],
      });
      userId = toId(userResult.lastInsertRowid);

      await tx.commit();
    } catch (err) {
      await tx.rollback();
      throw err;
    }

    const user = {
      id: userId,
      business_id: businessId,
      name,
      email: email.toLowerCase(),
      role: 'owner',
    };
    const token = signToken(user);

    res.status(201).json({ token, user });
  })
);

/**
 * POST /api/auth/login
 */
router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Informe email e senha' });
    }

    const result = await db.execute({
      sql: 'SELECT * FROM users WHERE email = ?',
      args: [email.toLowerCase()],
    });
    const user = result.rows[0];

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const token = signToken(user);
    res.json({
      token,
      user: {
        id: user.id,
        business_id: user.business_id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  })
);

/**
 * GET /api/auth/me
 */
router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await db.execute({
      sql: `SELECT u.id, u.name, u.email, u.role, u.business_id,
                   b.name AS business_name, b.plan
            FROM users u
            JOIN businesses b ON b.id = u.business_id
            WHERE u.id = ?`,
      args: [req.user.id],
    });

    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
    res.json({ user });
  })
);

module.exports = router;
