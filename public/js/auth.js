/**
 * Lógica compartilhada das páginas de login e cadastro.
 * Envia as credenciais para a API e armazena o token no localStorage.
 */
(function () {
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  const alertBox = document.getElementById('alert');
  const submitBtn = document.getElementById('submit-btn');

  // Redireciona se já estiver logado
  if (localStorage.getItem('petcare_token')) {
    window.location.href = '/dashboard.html';
    return;
  }

  function showError(message) {
    alertBox.textContent = message;
    alertBox.classList.remove('success');
    alertBox.classList.add('error', 'show');
  }

  function hideAlert() {
    alertBox.classList.remove('show');
  }

  async function postJSON(url, body) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Erro inesperado');
    return data;
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideAlert();
      submitBtn.disabled = true;
      submitBtn.textContent = 'Entrando...';
      try {
        const data = await postJSON('/api/auth/login', {
          email: loginForm.email.value.trim(),
          password: loginForm.password.value,
        });
        localStorage.setItem('petcare_token', data.token);
        localStorage.setItem('petcare_user', JSON.stringify(data.user));
        window.location.href = '/dashboard.html';
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
        const data = await postJSON('/api/auth/signup', {
          business_name: signupForm.business_name.value.trim(),
          name: signupForm.name.value.trim(),
          email: signupForm.email.value.trim(),
          password: signupForm.password.value,
        });
        localStorage.setItem('petcare_token', data.token);
        localStorage.setItem('petcare_user', JSON.stringify(data.user));
        window.location.href = '/dashboard.html';
      } catch (err) {
        showError(err.message);
        submitBtn.disabled = false;
        submitBtn.textContent = 'Criar conta';
      }
    });
  }
})();
