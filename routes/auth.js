const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../db');
const { signToken, requireAuth } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

/**
 * POST /api/auth/signup
 *
 * Historicamente esta rota criava um business + usuário owner diretamente
 * a partir do formulário público. A partir do novo fluxo comercial, o
 * acesso ao painel só é liberado pela equipe depois da confirmação do
 * plano — portanto esta rota foi desativada e responde 410 Gone com uma
 * orientação para o usuário agendar uma demonstração.
 */
router.post('/signup', (_req, res) => {
  res.status(410).json({
    error:
      'O cadastro direto foi desativado. Para conhecer a PetCare Pro, agende uma demonstração em /signup.',
    redirect: '/signup',
  });
});

/**
 * POST /api/auth/login
 *
 * Autentica o usuário e valida o status:
 * - `ativo`     → devolve token + user
 * - `pendente`  → HTTP 403 `status_pendente`
 * - `bloqueado` → HTTP 403 `status_bloqueado`
 *
 * O frontend usa o campo `code` para redirecionar para /acesso-restrito.
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

    // Bancos antigos podem não ter a coluna `status` preenchida; tratamos
    // qualquer valor que não seja exatamente 'ativo' como acesso restrito.
    const status = (user.status || 'pendente').toLowerCase();

    if (status !== 'ativo') {
      const code = status === 'bloqueado' ? 'status_bloqueado' : 'status_pendente';
      return res.status(403).json({
        error:
          status === 'bloqueado'
            ? 'Seu acesso está bloqueado. Entre em contato com nossa equipe para regularizar.'
            : 'Seu acesso ainda não foi liberado. Aguarde a confirmação do seu plano pela nossa equipe.',
        code,
        redirect: '/acesso-restrito',
      });
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
        status,
      },
    });
  })
);

/**
 * GET /api/auth/me
 *
 * Além de retornar o usuário, revalida o status a cada chamada — se a
 * equipe bloquear um usuário já logado, a próxima chamada de /me devolve
 * 403 e o frontend pode expulsar a sessão.
 */
router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await db.execute({
      sql: `SELECT u.id, u.name, u.email, u.role, u.status, u.business_id,
                   b.name AS business_name, b.plan
            FROM users u
            JOIN businesses b ON b.id = u.business_id
            WHERE u.id = ?`,
      args: [req.user.id],
    });

    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

    const status = (user.status || 'pendente').toLowerCase();
    if (status !== 'ativo') {
      return res.status(403).json({
        error: 'Acesso não liberado.',
        code: status === 'bloqueado' ? 'status_bloqueado' : 'status_pendente',
        redirect: '/acesso-restrito',
      });
    }

    res.json({ user });
  })
);

module.exports = router;
