/**
 * Lógica compartilhada das páginas de login e "Agendar demonstração".
 *
 * - /login: envia credenciais para /api/auth/login. Usuários com status
 *   diferente de `ativo` são redirecionados para /acesso-restrito.
 * - /signup: envia o formulário de demonstração para /api/demo-requests
 *   e exibe mensagem de sucesso inline (sem redirecionar).
 */
(function () {
  const loginForm = document.getElementById('login-form');
  const demoForm = document.getElementById('demo-request-form');
  const alertBox = document.getElementById('alert');
  const submitBtn = document.getElementById('submit-btn');

  // Helper seguro para localStorage — em modo privado/algumas extensões
  // acessar localStorage pode lançar exceção e quebrar toda a página.
  const storage = {
    get(key) {
      try { return localStorage.getItem(key); } catch (_) { return null; }
    },
    set(key, value) {
      try { localStorage.setItem(key, value); return true; } catch (_) { return false; }
    },
    remove(key) {
      try { localStorage.removeItem(key); } catch (_) {}
    },
  };

  // Health check proativo: se o backend estiver inacessível, mostra um banner
  // imediato para o usuário saber que precisa iniciar o servidor antes de tentar logar.
  fetch('/api/health', { method: 'GET' })
    .then((res) => {
      if (!res.ok) throw new Error('health not ok');
    })
    .catch(() => {
      showError(
        'Backend offline. Inicie o servidor com "npm start" e recarregue esta página.'
      );
    });

  // Se já existe token, valida no servidor antes de redirecionar.
  // Evita loop quando o token é inválido/expirado (stale).
  const existingToken = storage.get('petcare_token');
  if (existingToken && loginForm) {
    fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${existingToken}` },
    })
      .then((res) => {
        if (res.ok) {
          window.location.href = '/dashboard';
        } else if (res.status === 403) {
          // Token válido mas status virou pendente/bloqueado.
          storage.remove('petcare_token');
          storage.remove('petcare_user');
          window.location.href = '/acesso-restrito';
        } else {
          // Token inválido/expirado — limpa e mantém usuário no formulário
          storage.remove('petcare_token');
          storage.remove('petcare_user');
        }
      })
      .catch(() => {
        // Backend offline — remove o token para evitar loop e deixa o usuário tentar logar
        storage.remove('petcare_token');
        storage.remove('petcare_user');
      });
  }

  function showError(message) {
    if (!alertBox) return;
    alertBox.textContent = message;
    alertBox.classList.remove('success');
    alertBox.classList.add('error', 'show');
  }

  function showSuccess(message) {
    if (!alertBox) return;
    alertBox.textContent = message;
    alertBox.classList.remove('error');
    alertBox.classList.add('success', 'show');
  }

  function hideAlert() {
    if (!alertBox) return;
    alertBox.classList.remove('show');
  }

  async function postJSON(url, body) {
    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (networkErr) {
      // Falha de rede (servidor offline, DNS, CORS, etc.)
      const err = new Error(
        'Backend offline. Inicie o servidor com "npm start" no terminal e tente novamente.'
      );
      err.networkError = true;
      throw err;
    }

    let data = {};
    try {
      data = await res.json();
    } catch (_) {
      // resposta não-JSON (ex: HTML de erro 500 do proxy)
    }

    if (!res.ok) {
      const err = new Error(data.error || `Erro ${res.status}: não foi possível processar a requisição`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  function persistSession(data) {
    if (!data || !data.token || !data.user) {
      throw new Error('Resposta inválida do servidor');
    }
    const ok = storage.set('petcare_token', data.token) &&
               storage.set('petcare_user', JSON.stringify(data.user));
    if (!ok) {
      throw new Error('Não foi possível salvar a sessão (localStorage bloqueado?).');
    }
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideAlert();
      submitBtn.disabled = true;
      submitBtn.textContent = 'Entrando...';
      try {
        const email = loginForm.email.value.trim();
        const password = loginForm.password.value;
        if (!email || !password) {
          throw new Error('Informe email e senha');
        }
        const data = await postJSON('/api/auth/login', { email, password });
        persistSession(data);
        window.location.href = '/dashboard';
      } catch (err) {
        // Usuário com status pendente/bloqueado → redireciona para página
        // informativa que explica o fluxo de liberação.
        if (err && err.status === 403 && err.data && err.data.redirect) {
          window.location.href = err.data.redirect;
          return;
        }
        showError(err.message);
        submitBtn.disabled = false;
        submitBtn.textContent = 'Entrar';
      }
    });
  }

  if (demoForm) {
    demoForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideAlert();
      submitBtn.disabled = true;
      submitBtn.textContent = 'Enviando...';
      try {
        const nome = demoForm.nome.value.trim();
        const negocio = demoForm.negocio.value.trim();
        const email = demoForm.email.value.trim();
        const telefone = demoForm.telefone.value.trim();
        const tipo_negocio = demoForm.tipo_negocio.value;

        if (!nome || !negocio || !email || !telefone || !tipo_negocio) {
          throw new Error('Preencha todos os campos.');
        }

        const data = await postJSON('/api/demo-requests', {
          nome,
          negocio,
          email,
          telefone,
          tipo_negocio,
        });

        showSuccess(
          data.message ||
            'Recebemos seu cadastro! Nossa equipe entrará em contato em até 1 dia útil para agendar sua demonstração.'
        );
        demoForm.reset();
        submitBtn.textContent = 'Pedido enviado';
        // Mantém o botão desabilitado para evitar reenvios acidentais.
      } catch (err) {
        showError(err.message);
        submitBtn.disabled = false;
        submitBtn.textContent = 'Agendar demonstração';
      }
    });
  }
})();
