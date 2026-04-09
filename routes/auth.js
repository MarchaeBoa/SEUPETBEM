const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { signToken, requireAuth } = require('../middleware/auth');

const router = express.Router();

/**
 * POST /api/auth/signup
 * Cria um novo business e seu usuário owner.
 */
router.post('/signup', (req, res) => {
  const { name, email, password, business_name } = req.body || {};

  if (!name || !email || !password || !business_name) {
    return res.status(400).json({ error: 'Preencha nome, email, senha e nome do negócio' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) {
    return res.status(409).json({ error: 'Email já cadastrado' });
  }

  const hash = bcrypt.hashSync(password, 10);

  const createAll = db.transaction(() => {
    const bizResult = db
      .prepare('INSERT INTO businesses (name, plan) VALUES (?, ?)')
      .run(business_name, 'starter');
    const businessId = bizResult.lastInsertRowid;

    const userResult = db
      .prepare(
        'INSERT INTO users (business_id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)'
      )
      .run(businessId, name, email.toLowerCase(), hash, 'owner');

    return { userId: userResult.lastInsertRowid, businessId };
  });

  const { userId, businessId } = createAll();

  const user = {
    id: userId,
    business_id: businessId,
    name,
    email: email.toLowerCase(),
    role: 'owner',
  };
  const token = signToken(user);

  res.status(201).json({ token, user });
});

/**
 * POST /api/auth/login
 */
router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Informe email e senha' });
  }

  const user = db
    .prepare('SELECT * FROM users WHERE email = ?')
    .get(email.toLowerCase());

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
});

/**
 * GET /api/auth/me
 */
router.get('/me', requireAuth, (req, res) => {
  const user = db
    .prepare(
      `SELECT u.id, u.name, u.email, u.role, u.business_id,
              b.name AS business_name, b.plan
       FROM users u
       JOIN businesses b ON b.id = u.business_id
       WHERE u.id = ?`
    )
    .get(req.user.id);

  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
  res.json({ user });
});

module.exports = router;
