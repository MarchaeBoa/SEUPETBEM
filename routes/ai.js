/**
 * Rotas do Assistente IA do dashboard.
 *
 * - POST /api/ai/chat      → responde perguntas sobre como usar o PetCare Pro
 *                            e sobre os próprios dados do negócio.
 * - GET  /api/ai/insights  → gera insights financeiros/operacionais com base
 *                            nos dados reais do negócio (clientes, pets,
 *                            agendamentos, finanças).
 * - GET  /api/ai/history   → últimas mensagens trocadas com o assistente.
 *
 * Integra com a Claude API via fetch (sem dependência extra). Se
 * ANTHROPIC_API_KEY não estiver configurada, usa um fallback
 * heurístico baseado em regras para manter a feature funcional em dev.
 */
const express = require('express');
const { db } = require('../db');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();
router.use(requireAuth);

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

const SYSTEM_PROMPT = `Você é o Assistente PetCare Pro, uma IA que ajuda donos de
petshops, clínicas veterinárias e hotéis para pets a usarem o sistema PetCare Pro
e a tomarem decisões melhores sobre o negócio.

Capacidades do sistema PetCare Pro (o que o usuário pode fazer):
- Visão geral: estatísticas de clientes, pets, agendamentos e faturamento do mês.
- Clientes: cadastro completo de tutores (nome, e-mail, telefone, endereço).
- Pets: cadastro por tutor (nome, espécie, raça, nascimento, peso, observações).
- Agendamentos: agenda com serviço, data/hora, valor, status (agendado / concluído).
- Finanças: contas a pagar e a receber, com categorias, vencimentos e status de pago.
- Assistente IA: chat para dúvidas sobre o sistema e insights sobre o negócio.

Regras:
1. Responda sempre em português do Brasil, tom amigável, direto e prático.
2. Seja breve (máximo 6 linhas) a não ser que o usuário peça mais detalhes.
3. Quando o usuário perguntar sobre os dados dele, use APENAS o contexto fornecido
   no bloco <dados-do-negocio>. Não invente números.
4. Quando não souber algo, diga com honestidade que não tem essa informação.
5. Nunca exponha dados sensíveis de outros negócios.
6. Use emojis apenas quando fizer sentido (no máximo 1 por resposta).`;

// ───────────────────── Helpers de contexto ─────────────────────

async function getBusinessSnapshot(businessId) {
  const [clientsR, petsR, aptR, finIncomeR, finExpenseR, overdueR] = await Promise.all([
    db.execute({
      sql: 'SELECT COUNT(*) AS n FROM clients WHERE business_id = ?',
      args: [businessId],
    }),
    db.execute({
      sql: 'SELECT COUNT(*) AS n FROM pets WHERE business_id = ?',
      args: [businessId],
    }),
    db.execute({
      sql: `SELECT
              SUM(CASE WHEN status = 'agendado' AND scheduled_at >= datetime('now') THEN 1 ELSE 0 END) AS upcoming,
              COALESCE(SUM(CASE WHEN status = 'concluido'
                     AND scheduled_at >= datetime('now','start of month')
                     THEN price ELSE 0 END), 0) AS month_revenue
            FROM appointments WHERE business_id = ?`,
      args: [businessId],
    }),
    db.execute({
      sql: `SELECT COALESCE(SUM(amount), 0) AS total FROM finances
            WHERE business_id = ? AND type = 'receita'
              AND COALESCE(due_date, created_at) >= datetime('now', 'start of month')`,
      args: [businessId],
    }),
    db.execute({
      sql: `SELECT COALESCE(SUM(amount), 0) AS total FROM finances
            WHERE business_id = ? AND type = 'despesa'
              AND COALESCE(due_date, created_at) >= datetime('now', 'start of month')`,
      args: [businessId],
    }),
    db.execute({
      sql: `SELECT COUNT(*) AS n, COALESCE(SUM(amount), 0) AS total FROM finances
            WHERE business_id = ? AND paid = 0
              AND due_date IS NOT NULL AND due_date < datetime('now')`,
      args: [businessId],
    }),
  ]);

  return {
    total_clients: Number(clientsR.rows[0].n) || 0,
    total_pets: Number(petsR.rows[0].n) || 0,
    upcoming_appointments: Number(aptR.rows[0].upcoming) || 0,
    month_service_revenue: Number(aptR.rows[0].month_revenue) || 0,
    month_finance_income: Number(finIncomeR.rows[0].total) || 0,
    month_finance_expense: Number(finExpenseR.rows[0].total) || 0,
    month_balance:
      (Number(finIncomeR.rows[0].total) || 0) -
      (Number(finExpenseR.rows[0].total) || 0),
    overdue_count: Number(overdueR.rows[0].n) || 0,
    overdue_total: Number(overdueR.rows[0].total) || 0,
  };
}

function formatSnapshot(s) {
  const fmt = (v) =>
    Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  return `<dados-do-negocio>
- Total de clientes cadastrados: ${s.total_clients}
- Total de pets cadastrados: ${s.total_pets}
- Agendamentos futuros: ${s.upcoming_appointments}
- Faturamento do mês (serviços concluídos): ${fmt(s.month_service_revenue)}
- Receitas lançadas no mês: ${fmt(s.month_finance_income)}
- Despesas lançadas no mês: ${fmt(s.month_finance_expense)}
- Saldo do mês: ${fmt(s.month_balance)}
- Contas vencidas não pagas: ${s.overdue_count} (${fmt(s.overdue_total)})
</dados-do-negocio>`;
}

// ───────────────────── Claude API ─────────────────────

async function callClaude(messages, systemPrompt) {
  if (!ANTHROPIC_API_KEY) return null;

  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 600,
        system: systemPrompt,
        messages,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error('[ai] Claude API error', res.status, errText);
      return null;
    }

    const data = await res.json();
    const text = (data.content || [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();
    return text || null;
  } catch (err) {
    console.error('[ai] Claude API fetch failed', err.message);
    return null;
  }
}

// ───────────────────── Fallback heurístico ─────────────────────
// Quando ANTHROPIC_API_KEY não está configurada, usamos regras simples
// para manter o assistente funcional (útil em dev e demos offline).

const FAQ_RULES = [
  {
    keywords: ['cliente', 'clientes', 'tutor', 'tutores', 'cadastrar cliente'],
    answer:
      'Para cadastrar um cliente, vá até **Clientes** no menu lateral e clique em "+ Novo cliente". ' +
      'Preencha nome (obrigatório), e-mail, telefone e endereço. Depois você pode vincular pets a ele na aba Pets.',
  },
  {
    keywords: ['pet', 'pets', 'cachorro', 'gato', 'cadastrar pet'],
    answer:
      'Na aba **Pets**, clique em "+ Novo pet", escolha o tutor e preencha espécie, raça, peso e observações. ' +
      'Dica: cadastre primeiro o tutor na aba Clientes antes de adicionar o pet.',
  },
  {
    keywords: ['agendamento', 'agendar', 'agenda', 'marcar'],
    answer:
      'Em **Agendamentos** → "+ Novo agendamento", escolha o pet, descreva o serviço (ex: banho e tosa), ' +
      'data/hora e valor. Depois do atendimento, clique no ✓ para marcar como concluído — o valor entra no faturamento do mês.',
  },
  {
    keywords: ['finança', 'financeiro', 'despesa', 'conta a pagar', 'conta a receber', 'dinheiro', 'pagar'],
    answer:
      'Na aba **Finanças** você registra contas a pagar e a receber. Clique em "+ Novo lançamento", ' +
      'escolha tipo (receita/despesa), categoria, valor e vencimento. Contas vencidas aparecem destacadas no topo.',
  },
  {
    keywords: ['faturamento', 'receita', 'lucro', 'ganho'],
    answer:
      'O faturamento do mês na **Visão geral** soma os agendamentos concluídos no mês corrente. ' +
      'Já o saldo em **Finanças** considera as receitas e despesas que você lançou manualmente.',
  },
  {
    keywords: ['insight', 'dica', 'sugest', 'análise', 'analise'],
    answer:
      'Use o botão **"Gerar insights"** na aba Assistente IA para eu analisar seus dados do mês e ' +
      'apontar oportunidades (contas vencidas, melhores clientes, margens, etc.).',
  },
  {
    keywords: ['senha', 'esqueci', 'login', 'logar', 'entrar'],
    answer:
      'Se esqueceu a senha, volte para /login e clique em "Esqueci minha senha". ' +
      'Caso não receba o e-mail, fale com o suporte em suporte@petcarepro.com.br.',
  },
  {
    keywords: ['suporte', 'ajuda', 'contato', 'falar com humano', 'atendente'],
    answer:
      'Nossa equipe atende de segunda a sexta, 8h às 19h. Mande um e-mail para ' +
      'suporte@petcarepro.com.br ou chame no WhatsApp pelo chat no rodapé do site público.',
  },
];

function ruleBasedAnswer(message, snapshot) {
  const lower = String(message || '').toLowerCase();

  // Perguntas diretas sobre os próprios dados
  if (/quantos\s+clientes/.test(lower))
    return `Você tem **${snapshot.total_clients}** cliente(s) cadastrado(s) no momento.`;
  if (/quantos\s+pets/.test(lower))
    return `Você tem **${snapshot.total_pets}** pet(s) cadastrado(s).`;
  if (/quanto.*fatur|faturamento.*mês|faturamento\s+mensal/.test(lower)) {
    const v = snapshot.month_service_revenue.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
    return `Seu faturamento de serviços concluídos este mês é de **${v}**.`;
  }
  if (/saldo|lucro|quanto.*sobr/.test(lower)) {
    const v = snapshot.month_balance.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
    return `Seu saldo financeiro do mês é **${v}** (receitas lançadas menos despesas lançadas).`;
  }
  if (/vencid|atras/.test(lower)) {
    if (snapshot.overdue_count === 0)
      return 'Boa notícia: você não tem contas vencidas no momento. ✅';
    const v = snapshot.overdue_total.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
    return `Atenção: ${snapshot.overdue_count} conta(s) vencida(s), totalizando **${v}**. Abra a aba Finanças para quitá-las.`;
  }

  // FAQ por palavras-chave
  for (const rule of FAQ_RULES) {
    if (rule.keywords.some((k) => lower.includes(k))) return rule.answer;
  }

  return (
    'Posso te ajudar com cadastros (clientes, pets, agendamentos), com a aba de finanças ' +
    '(contas a pagar e receber) e com dicas sobre o negócio usando seus próprios dados. ' +
    'Pergunta mais específica, ex: "quantos clientes eu tenho?" ou "como cadastro um novo pet?"'
  );
}

function ruleBasedInsights(snapshot) {
  const fmt = (v) =>
    Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const lines = [];

  lines.push(`Visão geral: ${snapshot.total_clients} cliente(s), ${snapshot.total_pets} pet(s) e ${snapshot.upcoming_appointments} agendamento(s) futuro(s).`);

  if (snapshot.month_service_revenue > 0) {
    lines.push(`Serviços concluídos no mês somam ${fmt(snapshot.month_service_revenue)}. Continue registrando agendamentos para medir a evolução semana a semana.`);
  } else {
    lines.push('Nenhum agendamento concluído ainda este mês. Marque os atendimentos como concluídos para começar a ver seu faturamento real.');
  }

  if (snapshot.month_balance >= 0) {
    lines.push(`Saldo financeiro do mês positivo (${fmt(snapshot.month_balance)}). Considere reservar uma parte para capital de giro.`);
  } else {
    lines.push(`Atenção: saldo do mês negativo (${fmt(snapshot.month_balance)}). Revise despesas recorrentes em Finanças e avalie aumentar o ticket médio dos serviços.`);
  }

  if (snapshot.overdue_count > 0) {
    lines.push(`Você tem ${snapshot.overdue_count} conta(s) vencida(s) (${fmt(snapshot.overdue_total)}). Priorize quitá-las para evitar juros.`);
  }

  if (snapshot.total_clients > 0 && snapshot.total_pets === 0) {
    lines.push('Dica: cadastre os pets dos seus clientes para aproveitar o histórico clínico e enviar lembretes de vacina.');
  }

  return lines.join('\n\n');
}

// ───────────────────── Rotas ─────────────────────

/**
 * GET /api/ai/history — últimas 20 mensagens do usuário logado.
 */
router.get(
  '/history',
  asyncHandler(async (req, res) => {
    const result = await db.execute({
      sql: `SELECT id, role, content, created_at FROM ai_messages
            WHERE user_id = ? AND business_id = ?
            ORDER BY id DESC
            LIMIT 20`,
      args: [req.user.id, req.user.business_id],
    });
    // Devolve em ordem cronológica.
    res.json({ messages: result.rows.reverse() });
  })
);

/**
 * POST /api/ai/chat — envia uma mensagem para o assistente e salva o par.
 */
router.post(
  '/chat',
  asyncHandler(async (req, res) => {
    const message = String(req.body?.message || '').trim();
    if (!message) return res.status(400).json({ error: 'Mensagem é obrigatória' });
    if (message.length > 2000) {
      return res.status(400).json({ error: 'Mensagem muito longa (máx 2000 caracteres)' });
    }

    const snapshot = await getBusinessSnapshot(req.user.business_id);

    // Carrega contexto curto (últimas 10 mensagens) para dar continuidade.
    const historyR = await db.execute({
      sql: `SELECT role, content FROM ai_messages
            WHERE user_id = ? AND business_id = ?
            ORDER BY id DESC LIMIT 10`,
      args: [req.user.id, req.user.business_id],
    });
    const history = historyR.rows
      .reverse()
      .map((m) => ({ role: m.role, content: m.content }));

    const userContent = `${formatSnapshot(snapshot)}\n\nPergunta: ${message}`;
    const apiMessages = [...history, { role: 'user', content: userContent }];

    let answer = await callClaude(apiMessages, SYSTEM_PROMPT);
    let source = 'claude';
    if (!answer) {
      answer = ruleBasedAnswer(message, snapshot);
      source = 'fallback';
    }

    // Persiste o par (user + assistant) no histórico.
    await db.execute({
      sql: `INSERT INTO ai_messages (business_id, user_id, role, content) VALUES (?, ?, 'user', ?)`,
      args: [req.user.business_id, req.user.id, message],
    });
    await db.execute({
      sql: `INSERT INTO ai_messages (business_id, user_id, role, content) VALUES (?, ?, 'assistant', ?)`,
      args: [req.user.business_id, req.user.id, answer],
    });

    res.json({ answer, source });
  })
);

/**
 * GET /api/ai/insights — insights automáticos sobre o negócio.
 */
router.get(
  '/insights',
  asyncHandler(async (req, res) => {
    const snapshot = await getBusinessSnapshot(req.user.business_id);
    const prompt =
      'Com base nos dados do negócio abaixo, gere no máximo 4 insights objetivos ' +
      'sobre o desempenho do mês (finanças, operação, oportunidades). ' +
      'Cada insight em uma linha, começando com um emoji apropriado. ' +
      'Seja específico com números quando houver dados.\n\n' +
      formatSnapshot(snapshot);

    let insights = await callClaude(
      [{ role: 'user', content: prompt }],
      SYSTEM_PROMPT
    );
    let source = 'claude';
    if (!insights) {
      insights = ruleBasedInsights(snapshot);
      source = 'fallback';
    }

    res.json({ insights, snapshot, source });
  })
);

/**
 * DELETE /api/ai/history — limpa histórico de conversa do usuário atual.
 */
router.delete(
  '/history',
  asyncHandler(async (req, res) => {
    await db.execute({
      sql: 'DELETE FROM ai_messages WHERE user_id = ? AND business_id = ?',
      args: [req.user.id, req.user.business_id],
    });
    res.json({ success: true });
  })
);

module.exports = router;
