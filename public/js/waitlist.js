/**
 * Captura de e-mail da lista de espera (hero + CTA duplicado).
 *
 * Comportamento:
 *   1. Intercepta o submit de qualquer <form class="waitlist-form">;
 *   2. Valida o e-mail localmente (rápido, só para evitar POST desnecessário);
 *   3. Envia para POST /api/waitlist junto com UTMs extraídos da URL;
 *   4. Dispara o evento `lead_submit` no dataLayer (consumido pelo GTM);
 *   5. Redireciona para /obrigado?email=... para que a página de conversão
 *      possa disparar o evento `sign_up` / `conversion`;
 *   6. Em erro, exibe mensagem inline sem recarregar a página.
 *
 * Persistência dos UTMs: lemos da URL atual OU do sessionStorage (preenchido
 * no primeiro carregamento). Isto preserva a atribuição mesmo quando o
 * visitante navega entre seções antes de converter.
 */
(function () {
  'use strict';

  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
  var STORAGE_KEY = 'seupetbem_utms';

  // ─── UTM helpers ───
  function readUtmsFromLocation() {
    try {
      var params = new URLSearchParams(window.location.search);
      var out = {};
      for (var i = 0; i < UTM_KEYS.length; i++) {
        var v = params.get(UTM_KEYS[i]);
        if (v) out[UTM_KEYS[i]] = v.slice(0, 120);
      }
      return out;
    } catch (_) {
      return {};
    }
  }

  function persistUtms(utms) {
    if (Object.keys(utms).length === 0) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(utms));
    } catch (_) {}
  }

  function loadUtms() {
    var fromLocation = readUtmsFromLocation();
    if (Object.keys(fromLocation).length > 0) {
      persistUtms(fromLocation);
      return fromLocation;
    }
    try {
      var raw = sessionStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (_) {
      return {};
    }
  }

  // ─── Tracking helper ───
  // Se site-config.js carregou, usa a API; senão, empurra direto no dataLayer.
  function track(event, params) {
    if (window.SEUPETBEM && typeof window.SEUPETBEM.track === 'function') {
      window.SEUPETBEM.track(event, params);
      return;
    }
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(Object.assign({ event: event }, params || {}));
  }

  // ─── UI helpers ───
  function setFeedback(form, message, type) {
    // Cada formulário tem seu feedback com id <form-id>-feedback ou
    // waitlist-feedback(-cta). Tentamos ambos formatos para robustez.
    var id = form.id + '-feedback';
    var el = document.getElementById(id);
    if (!el) {
      // Fallback: procura o próximo irmão com a classe esperada.
      el = form.parentNode && form.parentNode.querySelector('.waitlist-feedback');
    }
    if (!el) return;
    el.textContent = message || '';
    el.classList.remove('is-ok', 'is-err');
    if (type) el.classList.add(type === 'ok' ? 'is-ok' : 'is-err');
  }

  function setBusy(form, busy) {
    var btn = form.querySelector('button[type="submit"]');
    if (!btn) return;
    btn.disabled = !!busy;
    if (busy) {
      btn.dataset.label = btn.textContent;
      btn.textContent = 'Enviando...';
    } else if (btn.dataset.label) {
      btn.textContent = btn.dataset.label;
    }
  }

  // ─── Submit handler ───
  function handleSubmit(form, source) {
    return function (e) {
      e.preventDefault();
      var input = form.querySelector('input[type="email"]');
      if (!input) return;

      var email = (input.value || '').trim().toLowerCase();
      if (!EMAIL_RE.test(email)) {
        setFeedback(form, 'Informe um e-mail válido para continuar.', 'err');
        input.focus();
        return;
      }

      setBusy(form, true);
      setFeedback(form, '', null);

      var utms = loadUtms();
      var payload = {
        email: email,
        source: source,
        consent_marketing: true,
        utm_source: utms.utm_source || null,
        utm_medium: utms.utm_medium || null,
        utm_campaign: utms.utm_campaign || null,
      };

      // O fetch é `no-cache` para evitar que intermediários sirvam uma
      // resposta antiga de idempotência — a API já garante idempotência
      // no servidor, mas queremos a resposta atualizada para feedback.
      fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-cache',
        body: JSON.stringify(payload),
      })
        .then(function (res) {
          return res.json().then(function (data) {
            return { ok: res.ok, status: res.status, data: data };
          });
        })
        .then(function (result) {
          if (!result.ok) {
            var msg = (result.data && result.data.error) || 'Não foi possível registrar agora. Tente novamente.';
            setFeedback(form, msg, 'err');
            setBusy(form, false);
            track('lead_submit_error', { source: source, status: result.status });
            return;
          }

          // Evento primário de conversão. O GTM usa este nome como trigger
          // tanto no GA4 quanto em pixels de mídia paga.
          track('lead_submit', {
            source: source,
            status: (result.data && result.data.status) || 'created',
          });

          // Redireciona para a página de obrigado, passando `status` para
          // evitar contar a mesma conversão duas vezes caso o usuário
          // recarregue (a página lê o parâmetro e só dispara uma vez).
          var qs = new URLSearchParams({
            status: (result.data && result.data.status) || 'created',
            source: source,
          });
          window.location.href = '/obrigado?' + qs.toString();
        })
        .catch(function (err) {
          console.error('[waitlist] erro de rede:', err);
          setFeedback(form, 'Erro de rede. Verifique sua conexão e tente novamente.', 'err');
          setBusy(form, false);
          track('lead_submit_error', { source: source, status: 0 });
        });
    };
  }

  // ─── Bootstrap ───
  function init() {
    // Persiste UTMs na primeira carga, mesmo que o visitante não submeta
    // de imediato — isso preserva atribuição entre páginas.
    loadUtms();

    var forms = document.querySelectorAll('form.waitlist-form');
    for (var i = 0; i < forms.length; i++) {
      var form = forms[i];
      // O `source` identifica de onde veio o lead no dataLayer: 'hero',
      // 'cta', 'pricing', etc. Usamos o id do form como fonte, ou 'unknown'.
      var source = (form.id || 'unknown').replace(/^waitlist-form-?/, '') || 'hero';
      form.addEventListener('submit', handleSubmit(form, source));
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
