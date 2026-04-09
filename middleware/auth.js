/**
 * Middleware de autenticação via JWT.
 * Extrai o token do header Authorization e popula req.user.
 */
const jwt = require('jsonwebtoken');

const DEFAULT_SECRET = 'dev-secret-change-me';
const JWT_SECRET = process.env.JWT_SECRET || DEFAULT_SECRET;

// Em produção, um segredo default é crítico — logamos um aviso explícito.
// O app continua rodando (para não derrubar todo o deploy), mas o operador
// precisa configurar JWT_SECRET com um valor aleatório e forte.
if (JWT_SECRET === DEFAULT_SECRET && process.env.NODE_ENV === 'production') {
  console.warn(
    '[auth] ATENÇÃO: JWT_SECRET não configurado em produção. ' +
    'Defina a variável de ambiente JWT_SECRET com um valor aleatório seguro.'
  );
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Token ausente' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = {
      id: payload.sub,
      business_id: payload.business_id,
      email: payload.email,
      role: payload.role,
    };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}

function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      business_id: user.business_id,
      email: user.email,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

module.exports = { requireAuth, signToken };
