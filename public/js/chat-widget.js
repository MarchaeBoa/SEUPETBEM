/**
 * PetCare Pro — Chat Support Widget
 * Lightweight self-contained support widget with a guided mini-bot
 * plus escalation to WhatsApp / email for human follow-up.
 */
(function () {
  'use strict';

  var WA_NUMBER  = '5511999999999';                 // placeholder commercial WhatsApp
  var EMAIL      = 'suporte@petcarepro.com.br';
  var SEEN_KEY   = 'pcp_chat_seen';
  var OPEN_DELAY = 1400;

  // ── FAQ tree ─────────────────────────────────────────────────────────────
  var FLOWS = {
    root: {
      msg: 'Oi! Sou o assistente virtual da PetCare Pro. Como posso te ajudar hoje?',
      options: [
        { label: 'Quero agendar uma demonstração', next: 'demo' },
        { label: 'Dúvidas sobre planos e preços', next: 'pricing' },
        { label: 'Migração do meu sistema atual', next: 'migration' },
        { label: 'Já sou cliente e preciso de ajuda', next: 'customer' },
        { label: 'Falar com um atendente humano', next: 'human' }
      ]
    },
    demo: {
      msg: 'Ótimo! A demonstração é guiada pela nossa equipe: mostramos a plataforma na prática, entendemos as necessidades do seu negócio e ajudamos você a escolher o plano certo. É só preencher o formulário em <a href="/signup">/signup</a> que entramos em contato em até 1 dia útil.',
      options: [
        { label: 'Agendar demonstração agora', href: '/signup' },
        { label: 'Tenho outra dúvida', next: 'root' }
      ]
    },
    pricing: {
      msg: 'Temos três planos: Starter (R$ 89/mês), Profissional (R$ 229/mês) e Enterprise (sob consulta). Você pode ver a comparação completa na <a href="#pricing">seção de planos</a>. Quer que eu explique algum?',
      options: [
        { label: 'Diferenças entre Starter e Profissional', next: 'plansCompare' },
        { label: 'Voltar ao menu', next: 'root' }
      ]
    },
    plansCompare: {
      msg: 'O Starter atende até 200 clientes e inclui agenda, prontuário básico e suporte por e-mail. O Profissional tem clientes ilimitados, prontuário completo, financeiro, marketing automatizado, até 5 usuários e suporte prioritário por chat (este aqui!).',
      options: [
        { label: 'Agendar demonstração do Profissional', href: '/signup' },
        { label: 'Voltar', next: 'pricing' }
      ]
    },
    migration: {
      msg: 'Fazemos a migração gratuita dos seus clientes, pets, histórico clínico e agenda, a partir de qualquer sistema concorrente ou planilha. Nossa equipe cuida de tudo e em até 24h você já está operando.',
      options: [
        { label: 'Falar com a equipe de migração', next: 'human' },
        { label: 'Voltar ao menu', next: 'root' }
      ]
    },
    customer: {
      msg: 'Se você já é cliente, o suporte prioritário fica disponível direto no painel, após o login. Também pode abrir um chamado por e-mail.',
      options: [
        { label: 'Abrir e-mail de suporte', href: 'mailto:' + EMAIL + '?subject=Suporte%20PetCare%20Pro' },
        { label: 'Ir para o login', href: '/login' },
        { label: 'Voltar ao menu', next: 'root' }
      ]
    },
    human: {
      msg: 'Sem problemas! Nossa equipe responde de segunda a sexta, das 8h às 19h. Escolha por onde prefere falar:',
      options: [
        { label: 'Falar pelo WhatsApp', href: 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent('Olá! Vim pelo chat do site da PetCare Pro e gostaria de falar com um atendente.') },
        { label: 'Enviar um e-mail', href: 'mailto:' + EMAIL + '?subject=Contato%20pelo%20site%20-%20PetCare%20Pro' },
        { label: 'Voltar ao menu', next: 'root' }
      ]
    }
  };

  // ── Build DOM ────────────────────────────────────────────────────────────
  var root = document.createElement('div');
  root.className = 'cw-root';
  root.innerHTML = [
    '<div class="cw-panel" role="dialog" aria-label="Chat de suporte PetCare Pro" aria-modal="false">',
      '<div class="cw-header">',
        '<div class="cw-header-top">',
          '<div class="cw-avatar" aria-hidden="true">',
            '<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">',
              '<path d="M10 21c0-3.5 2.5-6 6-6s6 2.5 6 6v1H10v-1z" fill="#fff"/>',
              '<circle cx="12" cy="12" r="1.8" fill="#fff"/>',
              '<circle cx="20" cy="12" r="1.8" fill="#fff"/>',
              '<circle cx="9"  cy="15.5" r="1.4" fill="#fff"/>',
              '<circle cx="23" cy="15.5" r="1.4" fill="#fff"/>',
            '</svg>',
          '</div>',
          '<div class="cw-header-text">',
            '<strong>Suporte PetCare Pro</strong>',
            '<span>Online agora</span>',
          '</div>',
        '</div>',
      '</div>',
      '<div class="cw-body" id="cw-body" aria-live="polite"></div>',
      '<div class="cw-footer">',
        '<form class="cw-input-row" id="cw-form" autocomplete="off">',
          '<input type="text" class="cw-input" id="cw-input" placeholder="Escreva sua mensagem..." aria-label="Sua mensagem" />',
          '<button type="submit" class="cw-send" id="cw-send" aria-label="Enviar mensagem" disabled>',
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">',
              '<line x1="22" y1="2" x2="11" y2="13"/>',
              '<polygon points="22 2 15 22 11 13 2 9 22 2"/>',
            '</svg>',
          '</button>',
        '</form>',
        '<div class="cw-legal">Ao conversar, você aceita nossa <a href="/privacidade" target="_blank" rel="noopener">Política de Privacidade</a>.</div>',
      '</div>',
    '</div>',
    '<button type="button" class="cw-launcher" id="cw-launcher" aria-label="Abrir chat de suporte" aria-expanded="false">',
      '<svg class="cw-icon-chat" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">',
        '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
      '</svg>',
      '<svg class="cw-icon-close" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">',
        '<line x1="18" y1="6" x2="6" y2="18"/>',
        '<line x1="6"  y1="6" x2="18" y2="18"/>',
      '</svg>',
      '<span class="cw-pulse" aria-hidden="true"></span>',
    '</button>'
  ].join('');

  document.body.appendChild(root);

  var launcher = root.querySelector('#cw-launcher');
  var panel    = root.querySelector('.cw-panel');
  var body     = root.querySelector('#cw-body');
  var form     = root.querySelector('#cw-form');
  var input    = root.querySelector('#cw-input');
  var sendBtn  = root.querySelector('#cw-send');

  var started = false;

  // ── Helpers ──────────────────────────────────────────────────────────────
  function scrollBottom() {
    body.scrollTop = body.scrollHeight;
  }

  function addMessage(text, role) {
    var el = document.createElement('div');
    el.className = 'cw-msg cw-msg-' + role;
    el.innerHTML = text;
    body.appendChild(el);
    scrollBottom();
    return el;
  }

  function addTyping() {
    var el = document.createElement('div');
    el.className = 'cw-msg cw-msg-bot';
    el.innerHTML = '<div class="cw-typing"><span></span><span></span><span></span></div>';
    body.appendChild(el);
    scrollBottom();
    return el;
  }

  function addQuickReplies(options, flowKey) {
    var wrap = document.createElement('div');
    wrap.className = 'cw-quick';
    options.forEach(function (opt) {
      var btn;
      if (opt.href) {
        btn = document.createElement('a');
        btn.href = opt.href;
        if (opt.href.indexOf('http') === 0 || opt.href.indexOf('mailto:') === 0) {
          btn.target = '_blank';
          btn.rel = 'noopener';
        }
      } else {
        btn = document.createElement('button');
        btn.type = 'button';
      }
      btn.textContent = opt.label;
      btn.addEventListener('click', function () {
        addMessage(escapeHtml(opt.label), 'user');
        wrap.remove();
        if (opt.next) {
          setTimeout(function () { runFlow(opt.next); }, 350);
        }
      });
      wrap.appendChild(btn);
    });
    body.appendChild(wrap);
    scrollBottom();
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function runFlow(key) {
    var flow = FLOWS[key];
    if (!flow) return;
    var typing = addTyping();
    setTimeout(function () {
      typing.remove();
      addMessage(flow.msg, 'bot');
      if (flow.options && flow.options.length) {
        setTimeout(function () { addQuickReplies(flow.options, key); }, 200);
      }
    }, 650);
  }

  function startConversation() {
    if (started) return;
    started = true;
    runFlow('root');
  }

  // ── Free-text handler (fallback) ─────────────────────────────────────────
  input.addEventListener('input', function () {
    sendBtn.disabled = input.value.trim().length === 0;
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var val = input.value.trim();
    if (!val) return;
    addMessage(escapeHtml(val), 'user');
    input.value = '';
    sendBtn.disabled = true;

    var typing = addTyping();
    setTimeout(function () {
      typing.remove();
      addMessage(
        'Obrigado pela mensagem! Para dar a melhor resposta possível, um atendente vai continuar esse papo. Como prefere seguir?',
        'bot'
      );
      setTimeout(function () {
        addQuickReplies(FLOWS.human.options, 'human');
      }, 200);
    }, 700);
  });

  // ── Open / close ─────────────────────────────────────────────────────────
  function openPanel() {
    root.classList.add('cw-open', 'cw-seen');
    launcher.setAttribute('aria-expanded', 'true');
    launcher.setAttribute('aria-label', 'Fechar chat de suporte');
    try { localStorage.setItem(SEEN_KEY, '1'); } catch (_) {}
    startConversation();
    setTimeout(function () { input.focus(); }, 250);
  }

  function closePanel() {
    root.classList.remove('cw-open');
    launcher.setAttribute('aria-expanded', 'false');
    launcher.setAttribute('aria-label', 'Abrir chat de suporte');
    launcher.focus();
  }

  launcher.addEventListener('click', function () {
    if (root.classList.contains('cw-open')) closePanel();
    else openPanel();
  });

  // Esc to close
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && root.classList.contains('cw-open')) closePanel();
  });

  // Hide pulse after first interaction on previous visits
  try {
    if (localStorage.getItem(SEEN_KEY)) root.classList.add('cw-seen');
  } catch (_) {}

  // Gentle attention nudge on first load
  setTimeout(function () {
    if (!root.classList.contains('cw-seen')) {
      // pulse already visible via CSS; nothing else to do
    }
  }, OPEN_DELAY);
})();
