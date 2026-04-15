/**
 * Configuração única e centralizada de dados institucionais e de tracking.
 *
 * Atualize APENAS este arquivo quando:
 *   • CNPJ, razão social ou endereço mudarem;
 *   • o contêiner do Google Tag Manager for provisionado;
 *   • os canais de contato institucionais mudarem.
 *
 * Todas as páginas HTML do site lêem este arquivo via <script src> e:
 *   1) injetam os dados institucionais em elementos [data-site=...]
 *   2) inicializam o GTM quando `gtmId` estiver definido
 *   3) expõem `window.SEUPETBEM` para os scripts de tracking disparar eventos.
 *
 * Mantenha este arquivo cacheável (sem valores secretos). Nunca coloque
 * credenciais de servidor aqui — use variáveis de ambiente no backend.
 */
(function () {
  'use strict';

  // ─────────── CONFIGURAÇÃO ───────────
  // Substitua os placeholders marcados com TODO pelos valores reais antes
  // de ir para produção. Deixe o `gtmId` como null se ainda não tiver um
  // contêiner do GTM — o script não dispara chamadas externas nesse caso.
  var config = {
    // Identidade de marca
    brand: 'PetCare Pro',

    // Razão social e CNPJ — exibidos no rodapé, em páginas legais e no DPO.
    legalName: 'Soutag Tecnologia Brasil LTDA',
    cnpj: '50.892.860/0001-55',
    address: 'São Paulo — SP, Brasil',

    // E-mails institucionais
    contactEmail: 'contato@petcarepro.com.br',
    salesEmail: 'vendas@petcarepro.com.br',
    dpoEmail: 'dpo@petcarepro.com.br',

    // Copyright line — ano é calculado dinamicamente abaixo.
    copyrightYear: new Date().getFullYear(),

    // ─── Tracking ───
    // ID do contêiner do Google Tag Manager (GTM-XXXXXXX). Enquanto for
    // null, nenhum script externo é carregado e o dataLayer ainda funciona
    // localmente (útil para desenvolvimento).
    // TODO: operador — provisione o contêiner em https://tagmanager.google.com
    // e cole o ID aqui.
    gtmId: null,
  };

  // ─────────── DATA LAYER / GTM ───────────
  // O dataLayer precisa existir ANTES do snippet do GTM, e também antes
  // de qualquer código da aplicação tentar empurrar eventos. Inicializamos
  // aqui de forma idempotente.
  window.dataLayer = window.dataLayer || [];

  function pushEvent(eventName, params) {
    window.dataLayer.push(Object.assign({ event: eventName }, params || {}));
  }

  function loadGTM(gtmId) {
    if (!gtmId || typeof gtmId !== 'string' || !/^GTM-[A-Z0-9]+$/i.test(gtmId)) {
      return;
    }
    // Snippet oficial do GTM, reescrito em JS moderno. O `gtm.start` marca
    // o início do carregamento para que o próprio GTM meça latência.
    pushEvent('gtm.js', { 'gtm.start': new Date().getTime() });
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtm.js?id=' + encodeURIComponent(gtmId);
    var first = document.getElementsByTagName('script')[0];
    first.parentNode.insertBefore(s, first);

    // Fallback <noscript> para browsers com JS desligado — insere o iframe
    // padrão do GTM no topo do <body>.
    document.addEventListener('DOMContentLoaded', function () {
      var noscript = document.createElement('noscript');
      var iframe = document.createElement('iframe');
      iframe.src = 'https://www.googletagmanager.com/ns.html?id=' + encodeURIComponent(gtmId);
      iframe.height = '0';
      iframe.width = '0';
      iframe.style.display = 'none';
      iframe.style.visibility = 'hidden';
      noscript.appendChild(iframe);
      if (document.body) document.body.insertBefore(noscript, document.body.firstChild);
    });
  }

  // ─────────── INJEÇÃO NO DOM ───────────
  // Qualquer elemento com [data-site="<chave>"] recebe o valor correspondente
  // como textContent quando o DOM estiver pronto. Exemplos:
  //   <span data-site="cnpj"></span>      → "50.892.860/0001-55"
  //   <span data-site="legalName"></span> → "Soutag Tecnologia Brasil LTDA"
  function injectSiteData() {
    var nodes = document.querySelectorAll('[data-site]');
    for (var i = 0; i < nodes.length; i++) {
      var key = nodes[i].getAttribute('data-site');
      if (key && Object.prototype.hasOwnProperty.call(config, key)) {
        nodes[i].textContent = config[key];
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectSiteData);
  } else {
    injectSiteData();
  }

  // ─────────── API PÚBLICA ───────────
  // Expomos `window.SEUPETBEM` para que outros scripts possam:
  //   SEUPETBEM.track('lead_submit', { source: 'hero' });
  //   SEUPETBEM.config.contactEmail
  window.SEUPETBEM = {
    config: config,
    track: pushEvent,
  };

  loadGTM(config.gtmId);
})();
