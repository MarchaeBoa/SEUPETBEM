/**
 * Lógica compartilhada das páginas de login e cadastro.
 * Envia as credenciais para a API e armazena o token no localStorage.
 */
(function () {
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
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
  if (existingToken) {
    fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${existingToken}` },
    })
      .then((res) => {
        if (res.ok) {
          window.location.href = '/dashboard';
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
      throw new Error(
        'Backend offline. Inicie o servidor com "npm start" no terminal e tente novamente.'
      );
    }

    let data = {};
    try {
      data = await res.json();
    } catch (_) {
      // resposta não-JSON (ex: HTML de erro 500 do proxy)
    }

    if (!res.ok) {
      throw new Error(data.error || `Erro ${res.status}: não foi possível processar a requisição`);
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
        showError(err.message);
        submitBtn.disabled = false;
        submitBtn.textContent = 'Entrar';
      }
    });
  }

  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideAlert();
      submitBtn.disabled = true;
      submitBtn.textContent = 'Criando conta...';
      try {
        const business_name = signupForm.business_name.value.trim();
        const name = signupForm.name.value.trim();
        const email = signupForm.email.value.trim();
        const password = signupForm.password.value;

        if (!business_name || !name || !email || !password) {
          throw new Error('Preencha todos os campos');
        }
        if (password.length < 6) {
          throw new Error('A senha deve ter pelo menos 6 caracteres');
        }

        const data = await postJSON('/api/auth/signup', {
          business_name,
          name,
          email,
          password,
        });
        persistSession(data);
        window.location.href = '/dashboard';
      } catch (err) {
        showError(err.message);
        submitBtn.disabled = false;
        submitBtn.textContent = 'Criar conta';
      }
    });
  }
})();
