const express = require('express');
const bcrypt = require('bcryptjs');
const { query, queryOne } = require('../db');
const { signToken, requireAuth } = require('../middleware/auth');

const router = express.Router();

/**
 * POST /api/auth/signup
 * Cria um novo business e seu usuário owner de forma atômica (CTE).
 */
router.post('/signup', async (req, res, next) => {
  try {
    const { name, email, password, business_name } = req.body || {};

    if (!name || !email || !password || !business_name) {
      return res.status(400).json({ error: 'Preencha nome, email, senha e nome do negócio' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres' });
    }

    const existing = await queryOne(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );
    if (existing) {
      return res.status(409).json({ error: 'Email já cadastrado' });
    }

    const hash = bcrypt.hashSync(password, 10);

    // CTE garante que business e user sejam criados em uma única transação.
    const created = await queryOne(
      `WITH new_business AS (
         INSERT INTO businesses (name, plan) VALUES ($1, 'starter') RETURNING id
       )
       INSERT INTO users (business_id, name, email, password_hash, role)
       SELECT nb.id, $2, $3, $4, 'owner' FROM new_business nb
       RETURNING id, business_id`,
      [business_name, name, email.toLowerCase(), hash]
    );

    const user = {
      id: created.id,
      business_id: created.business_id,
      name,
      email: email.toLowerCase(),
      role: 'owner',
    };
    const token = signToken(user);

    res.status(201).json({ token, user });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/login
 */
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Informe email e senha' });
    }

    const user = await queryOne(
      'SELECT * FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

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
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/auth/me
 */
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await queryOne(
      `SELECT u.id, u.name, u.email, u.role, u.business_id,
              b.name AS business_name, b.plan
         FROM users u
         JOIN businesses b ON b.id = u.business_id
        WHERE u.id = $1`,
      [req.user.id]
    );

    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
