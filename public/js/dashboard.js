/**
 * Lógica do painel PetCare Pro.
 * - Cuida da autenticação (redireciona para login se não houver token)
 * - Navega entre as views
 * - Consome a API REST e renderiza as tabelas / modais
 */
(function () {
  const token = localStorage.getItem('petcare_token');
  if (!token) {
    window.location.href = '/login';
    return;
  }

  // ───────── Helpers ─────────
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const state = {
    clients: [],
    pets: [],
    appointments: [],
    finances: [],
    financeFilter: 'all',
    aiLoading: false,
  };

  async function api(path, options = {}) {
    const res = await fetch(path, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });

    if (res.status === 401) {
      localStorage.removeItem('petcare_token');
      localStorage.removeItem('petcare_user');
      window.location.href = '/login';
      throw new Error('Sessão expirada');
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Erro na requisição');
    return data;
  }

  const toastEl = $('#toast');
  function toast(message, type = 'success') {
    toastEl.textContent = message;
    toastEl.className = `toast show ${type}`;
    setTimeout(() => toastEl.classList.remove('show'), 2800);
  }

  function formatCurrency(value) {
    return (Number(value) || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  }

  function formatDateTime(iso) {
    if (!iso) return '–';
    const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T'));
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function formatDate(iso) {
    if (!iso) return '–';
    const d = new Date(iso.includes('T') ? iso : iso + 'T00:00:00');
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  function escapeHtml(str) {
    if (str == null) return '';
    return String(str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  // ───────── Navigation ─────────
  $$('.nav-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      $$('.nav-item').forEach((b) => b.classList.toggle('active', b === btn));
      $$('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${view}`));

      if (view === 'overview') loadOverview();
      if (view === 'clients') loadClients();
      if (view === 'pets') loadPets();
      if (view === 'appointments') loadAppointments();
      if (view === 'finances') loadFinances();
      if (view === 'ai') loadAiHistory();
      if (view === 'leads') loadLeads();
    });
  });

  // ───────── Logout ─────────
  $('#logout-btn').addEventListener('click', () => {
    localStorage.removeItem('petcare_token');
    localStorage.removeItem('petcare_user');
    window.location.href = '/';
  });

  // ───────── Modals ─────────
  $$('[data-open-modal]').forEach((btn) => {
    btn.addEventListener('click', () => openModal(btn.dataset.openModal));
  });
  $$('[data-close-modal]').forEach((btn) => {
    btn.addEventListener('click', () => closeModal(btn.closest('.modal').id));
  });
  $$('.modal').forEach((modal) => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal(modal.id);
    });
  });

  function openModal(id) {
    $(`#${id}`).classList.add('active');
    if (id === 'pet-modal') populatePetClientSelect();
    if (id === 'appointment-modal') populateAppointmentPetSelect();
  }
  function closeModal(id) {
    const modal = $(`#${id}`);
    modal.classList.remove('active');
    const form = modal.querySelector('form');
    if (form) form.reset();
  }

  // ───────── User header ─────────
  async function loadUser() {
    try {
      const { user } = await api('/api/auth/me');
      if (!user) throw new Error('Usuário não encontrado');
      $('#user-name').textContent = user.name || '–';
      $('#business-name').textContent = user.business_name || '–';
    } catch (err) {
      // Erro de rede / 500: mostra toast. 401 já é tratado em api() (redireciona).
      console.error(err);
      toast('Não foi possível carregar seus dados. Tente novamente.', 'error');
    }
  }

  // ───────── Overview ─────────
  async function loadOverview() {
    try {
      const { stats, next_appointments } = await api('/api/dashboard/stats');
      $('#stat-clients').textContent = stats.total_clients;
      $('#stat-pets').textContent = stats.total_pets;
      $('#stat-upcoming').textContent = stats.upcoming_appointments;
      $('#stat-month-revenue').textContent = formatCurrency(stats.month_revenue);

      const list = $('#next-appointments');
      if (!next_appointments.length) {
        list.innerHTML = '<div class="empty">Nenhum agendamento futuro.</div>';
      } else {
        list.innerHTML = next_appointments
          .map(
            (a) => `
            <div class="list-item">
              <div class="list-item-main">
                <strong>${escapeHtml(a.pet_name)} · ${escapeHtml(a.service)}</strong>
                <span>Tutor: ${escapeHtml(a.client_name)}</span>
              </div>
              <div class="list-item-time">${formatDateTime(a.scheduled_at)}</div>
            </div>`
          )
          .join('');
      }
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  // ───────── Clients ─────────
  async function loadClients() {
    try {
      const { clients } = await api('/api/clients');
      state.clients = clients;
      const tbody = $('#clients-tbody');
      $('#clients-empty').classList.toggle('hidden', clients.length > 0);
      tbody.innerHTML = clients
        .map(
          (c) => `
          <tr>
            <td><strong>${escapeHtml(c.name)}</strong></td>
            <td>${escapeHtml(c.email || '–')}</td>
            <td>${escapeHtml(c.phone || '–')}</td>
            <td>${c.pet_count}</td>
            <td>
              <button class="btn-icon" data-delete-client="${c.id}" title="Excluir">🗑️</button>
            </td>
          </tr>`
        )
        .join('');
      $$('[data-delete-client]', tbody).forEach((btn) =>
        btn.addEventListener('click', () => deleteClient(btn.dataset.deleteClient))
      );
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function deleteClient(id) {
    if (!confirm('Excluir este cliente? Os pets e agendamentos relacionados também serão removidos.')) return;
    try {
      await api(`/api/clients/${id}`, { method: 'DELETE' });
      toast('Cliente removido');
      loadClients();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  $('#client-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const body = {
      name: form.name.value.trim(),
      email: form.email.value.trim(),
      phone: form.phone.value.trim(),
      address: form.address.value.trim(),
    };
    try {
      await api('/api/clients', { method: 'POST', body: JSON.stringify(body) });
      closeModal('client-modal');
      toast('Cliente cadastrado');
      loadClients();
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  // ───────── Pets ─────────
  async function loadPets() {
    try {
      const { pets } = await api('/api/pets');
      state.pets = pets;
      const tbody = $('#pets-tbody');
      $('#pets-empty').classList.toggle('hidden', pets.length > 0);
      tbody.innerHTML = pets
        .map(
          (p) => `
          <tr>
            <td><strong>${escapeHtml(p.name)}</strong></td>
            <td>${escapeHtml(p.species)}</td>
            <td>${escapeHtml(p.breed || '–')}</td>
            <td>${escapeHtml(p.client_name)}</td>
            <td>${p.weight ? p.weight + ' kg' : '–'}</td>
            <td>
              <button class="btn-icon" data-delete-pet="${p.id}" title="Excluir">🗑️</button>
            </td>
          </tr>`
        )
        .join('');
      $$('[data-delete-pet]', tbody).forEach((btn) =>
        btn.addEventListener('click', () => deletePet(btn.dataset.deletePet))
      );
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function deletePet(id) {
    if (!confirm('Excluir este pet? Os agendamentos relacionados também serão removidos.')) return;
    try {
      await api(`/api/pets/${id}`, { method: 'DELETE' });
      toast('Pet removido');
      loadPets();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function populatePetClientSelect() {
    if (!state.clients.length) {
      try {
        const { clients } = await api('/api/clients');
        state.clients = clients;
      } catch (err) {
        toast(err.message, 'error');
        return;
      }
    }
    const select = $('#pet-client-select');
    if (!state.clients.length) {
      select.innerHTML = '<option value="">Cadastre um cliente primeiro</option>';
      return;
    }
    select.innerHTML =
      '<option value="">Selecione o tutor</option>' +
      state.clients.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
  }

  $('#pet-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const body = {
      client_id: Number(form.client_id.value),
      name: form.name.value.trim(),
      species: form.species.value,
      breed: form.breed.value.trim(),
      birth_date: form.birth_date.value || null,
      weight: form.weight.value ? Number(form.weight.value) : null,
      notes: form.notes.value.trim(),
    };
    if (!body.client_id) {
      toast('Selecione um tutor válido', 'error');
      return;
    }
    try {
      await api('/api/pets', { method: 'POST', body: JSON.stringify(body) });
      closeModal('pet-modal');
      toast('Pet cadastrado');
      loadPets();
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  // ───────── Appointments ─────────
  async function loadAppointments() {
    try {
      const { appointments } = await api('/api/appointments');
      state.appointments = appointments;
      const tbody = $('#appointments-tbody');
      $('#appointments-empty').classList.toggle('hidden', appointments.length > 0);
      tbody.innerHTML = appointments
        .map(
          (a) => `
          <tr>
            <td>${formatDateTime(a.scheduled_at)}</td>
            <td><strong>${escapeHtml(a.pet_name)}</strong></td>
            <td>${escapeHtml(a.client_name)}</td>
            <td>${escapeHtml(a.service)}</td>
            <td>${formatCurrency(a.price)}</td>
            <td><span class="badge ${a.status}">${a.status}</span></td>
            <td>
              ${a.status === 'agendado'
                ? `<button class="btn-icon btn-edit" data-done="${a.id}" title="Concluir">✓</button>`
                : ''}
              <button class="btn-icon" data-delete-apt="${a.id}" title="Excluir">🗑️</button>
            </td>
          </tr>`
        )
        .join('');
      $$('[data-done]', tbody).forEach((btn) =>
        btn.addEventListener('click', () => markDone(btn.dataset.done))
      );
      $$('[data-delete-apt]', tbody).forEach((btn) =>
        btn.addEventListener('click', () => deleteAppointment(btn.dataset.deleteApt))
      );
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function markDone(id) {
    try {
      await api(`/api/appointments/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'concluido' }),
      });
      toast('Agendamento concluído');
      loadAppointments();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function deleteAppointment(id) {
    if (!confirm('Excluir este agendamento?')) return;
    try {
      await api(`/api/appointments/${id}`, { method: 'DELETE' });
      toast('Agendamento removido');
      loadAppointments();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function populateAppointmentPetSelect() {
    if (!state.pets.length) {
      try {
        const { pets } = await api('/api/pets');
        state.pets = pets;
      } catch (err) {
        toast(err.message, 'error');
        return;
      }
    }
    const select = $('#appointment-pet-select');
    if (!state.pets.length) {
      select.innerHTML = '<option value="">Cadastre um pet primeiro</option>';
      return;
    }
    select.innerHTML =
      '<option value="">Selecione o pet</option>' +
      state.pets
        .map(
          (p) =>
            `<option value="${p.id}">${escapeHtml(p.name)} (${escapeHtml(p.client_name)})</option>`
        )
        .join('');
  }

  $('#appointment-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const body = {
      pet_id: Number(form.pet_id.value),
      service: form.service.value.trim(),
      scheduled_at: form.scheduled_at.value,
      price: form.price.value ? Number(form.price.value) : 0,
      notes: form.notes.value.trim(),
    };
    if (!body.pet_id) {
      toast('Selecione um pet válido', 'error');
      return;
    }
    try {
      await api('/api/appointments', { method: 'POST', body: JSON.stringify(body) });
      closeModal('appointment-modal');
      toast('Agendamento criado');
      loadAppointments();
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  // ───────── Leads / Lista de espera ─────────
  // A waitlist é um recurso global (não por tenant) — qualquer usuário
  // autenticado consegue ver. Renderiza tabela + stats e oferece export CSV
  // para o time de marketing/comercial trabalhar a lista fora do painel.
  async function loadLeads() {
    try {
      const [listData, statsData] = await Promise.all([
        api('/api/waitlist?limit=200'),
        api('/api/waitlist/stats'),
      ]);

      $('#stat-leads-total').textContent = statsData.total || 0;
      $('#stat-leads-7d').textContent = statsData.last_7_days || 0;
      $('#stat-leads-30d').textContent = statsData.last_30_days || 0;

      const leads = listData.leads || [];
      const tbody = $('#leads-tbody');
      $('#leads-empty').classList.toggle('hidden', leads.length > 0);
      tbody.innerHTML = leads
        .map(
          (l) => `
          <tr>
            <td>${formatDateTime(l.created_at)}</td>
            <td><strong>${escapeHtml(l.email)}</strong></td>
            <td>${escapeHtml(l.name || '–')}</td>
            <td>${escapeHtml(l.business_name || '–')}</td>
            <td>${escapeHtml(l.source || '–')}${l.utm_source ? ' · ' + escapeHtml(l.utm_source) : ''}</td>
          </tr>`
        )
        .join('');

      // Guarda a última lista carregada para o botão de export.
      state.leads = leads;
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  // Export CSV — gera no cliente a partir do state.leads.
  // Escapa aspas duplicando-as, conforme RFC 4180.
  function exportLeadsCsv() {
    const leads = state.leads || [];
    if (!leads.length) {
      toast('Nada para exportar', 'error');
      return;
    }
    const header = ['created_at', 'email', 'name', 'business_name', 'business_type', 'phone', 'source', 'utm_source', 'utm_medium', 'utm_campaign'];
    const escape = (v) => {
      if (v == null) return '';
      const s = String(v);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const rows = leads.map((l) => header.map((h) => escape(l[h])).join(','));
    const csv = '\uFEFF' + header.join(',') + '\n' + rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `waitlist-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const exportBtn = $('#leads-export-btn');
  if (exportBtn) exportBtn.addEventListener('click', exportLeadsCsv);

  // ───────── Finanças ─────────
  async function loadFinances() {
    try {
      const [listData, statsData] = await Promise.all([
        api('/api/finances'),
        api('/api/finances/stats'),
      ]);

      state.finances = listData.finances || [];

      // Stats
      $('#stat-finance-income').textContent = formatCurrency(statsData.stats.month_income);
      $('#stat-finance-expense').textContent = formatCurrency(statsData.stats.month_expense);
      $('#stat-finance-balance').textContent = formatCurrency(statsData.stats.month_balance);
      $('#stat-finance-overdue').textContent = statsData.stats.overdue_count;

      // Destaque vermelho se houver contas vencidas.
      const overdueCard = $('#stat-finance-overdue-card');
      overdueCard.classList.toggle('danger', statsData.stats.overdue_count > 0);

      // Próximos vencimentos
      const upcomingWrap = $('#finance-upcoming');
      const upcomingCard = $('#finance-upcoming-card');
      const upcoming = statsData.upcoming || [];
      if (!upcoming.length) {
        upcomingCard.classList.add('hidden');
      } else {
        upcomingCard.classList.remove('hidden');
        upcomingWrap.innerHTML = upcoming
          .map(
            (u) => `
            <div class="list-item">
              <div class="list-item-main">
                <strong>${escapeHtml(u.description)}</strong>
                <span>${u.type === 'receita' ? 'A receber' : 'A pagar'} · ${formatCurrency(u.amount)}</span>
              </div>
              <div class="list-item-time">${formatDate(u.due_date)}</div>
            </div>`
          )
          .join('');
      }

      renderFinancesTable();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  function renderFinancesTable() {
    const tbody = $('#finances-tbody');
    const filter = state.financeFilter;

    let items = state.finances;
    if (filter === 'receita') items = items.filter((f) => f.type === 'receita');
    else if (filter === 'despesa') items = items.filter((f) => f.type === 'despesa');
    else if (filter === 'unpaid') items = items.filter((f) => !f.paid);

    $('#finances-empty').classList.toggle('hidden', items.length > 0);

    const now = new Date();
    tbody.innerHTML = items
      .map((f) => {
        const isOverdue =
          !f.paid && f.due_date && new Date(f.due_date) < now;
        const statusLabel = f.paid
          ? (f.type === 'receita' ? 'recebido' : 'pago')
          : isOverdue
            ? 'vencido'
            : 'em-aberto';
        const statusText = f.paid
          ? (f.type === 'receita' ? 'Recebido' : 'Pago')
          : isOverdue
            ? 'Vencido'
            : 'Em aberto';
        const amountClass = f.type === 'receita' ? 'finance-amount-in' : 'finance-amount-out';
        const amountPrefix = f.type === 'receita' ? '+ ' : '- ';
        return `
          <tr>
            <td>${formatDate(f.due_date) || '–'}</td>
            <td><strong>${escapeHtml(f.description)}</strong></td>
            <td>${escapeHtml(f.category || '–')}</td>
            <td><span class="badge ${f.type}">${f.type}</span></td>
            <td class="${amountClass}">${amountPrefix}${formatCurrency(f.amount)}</td>
            <td><span class="badge ${statusLabel}">${statusText}</span></td>
            <td>
              ${!f.paid
                ? `<button class="btn-icon btn-edit" data-pay-finance="${f.id}" title="Marcar como pago">✓</button>`
                : ''}
              <button class="btn-icon" data-delete-finance="${f.id}" title="Excluir">🗑️</button>
            </td>
          </tr>`;
      })
      .join('');

    $$('[data-pay-finance]', tbody).forEach((btn) =>
      btn.addEventListener('click', () => markFinancePaid(btn.dataset.payFinance))
    );
    $$('[data-delete-finance]', tbody).forEach((btn) =>
      btn.addEventListener('click', () => deleteFinance(btn.dataset.deleteFinance))
    );
  }

  $$('[data-finance-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.financeFilter = btn.dataset.financeFilter;
      $$('[data-finance-filter]').forEach((b) =>
        b.classList.toggle('chip-active', b === btn)
      );
      renderFinancesTable();
    });
  });

  async function markFinancePaid(id) {
    try {
      await api(`/api/finances/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ paid: true }),
      });
      toast('Lançamento atualizado');
      loadFinances();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function deleteFinance(id) {
    if (!confirm('Excluir este lançamento financeiro?')) return;
    try {
      await api(`/api/finances/${id}`, { method: 'DELETE' });
      toast('Lançamento removido');
      loadFinances();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  $('#finance-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const body = {
      type: form.type.value,
      category: form.category.value.trim(),
      description: form.description.value.trim(),
      amount: Number(form.amount.value),
      due_date: form.due_date.value || null,
      paid: form.paid.checked,
      notes: form.notes.value.trim(),
    };
    if (!body.type) {
      toast('Selecione receita ou despesa', 'error');
      return;
    }
    if (!body.description) {
      toast('Descrição é obrigatória', 'error');
      return;
    }
    if (!(body.amount > 0)) {
      toast('Valor deve ser maior que zero', 'error');
      return;
    }
    try {
      await api('/api/finances', { method: 'POST', body: JSON.stringify(body) });
      closeModal('finance-modal');
      toast('Lançamento registrado');
      loadFinances();
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  // ───────── Assistente IA ─────────
  // Conecta ao endpoint /api/ai/chat (com fallback de regras no backend),
  // persiste histórico no servidor e renderiza balões de conversa.
  const aiChatBody = $('#ai-chat-body');
  const aiChatForm = $('#ai-chat-form');
  const aiChatInput = $('#ai-chat-input');
  const aiChatSend = $('#ai-chat-send');
  const aiInsightsCard = $('#ai-insights-card');
  const aiInsightsContent = $('#ai-insights-content');
  const aiInsightsBtn = $('#ai-insights-btn');
  const aiInsightsClose = $('#ai-insights-close');
  const aiClearBtn = $('#ai-chat-clear');

  function aiRenderMessage(role, content) {
    // Remove a tela vazia na primeira mensagem real.
    const empty = aiChatBody.querySelector('.ai-chat-empty');
    if (empty) empty.remove();

    const wrap = document.createElement('div');
    wrap.className = `ai-chat-msg ${role}`;
    wrap.innerHTML = `
      <div class="ai-chat-avatar-sm">${role === 'user' ? '🧑' : '🤖'}</div>
      <div class="ai-chat-msg-bubble">${aiFormatContent(content)}</div>
    `;
    aiChatBody.appendChild(wrap);
    aiChatBody.scrollTop = aiChatBody.scrollHeight;
    return wrap;
  }

  function aiFormatContent(content) {
    // Escapa HTML e depois aplica formatação simples (negrito com **texto**).
    const escaped = escapeHtml(content);
    return escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  }

  function aiShowTyping() {
    const wrap = document.createElement('div');
    wrap.className = 'ai-chat-msg assistant';
    wrap.dataset.typing = '1';
    wrap.innerHTML = `
      <div class="ai-chat-avatar-sm">🤖</div>
      <div class="ai-chat-msg-bubble">
        <div class="ai-chat-typing"><span></span><span></span><span></span></div>
      </div>
    `;
    aiChatBody.appendChild(wrap);
    aiChatBody.scrollTop = aiChatBody.scrollHeight;
    return wrap;
  }

  async function loadAiHistory() {
    try {
      const { messages } = await api('/api/ai/history');
      if (!messages || !messages.length) return;
      // Limpa e renderiza tudo do zero
      aiChatBody.innerHTML = '';
      messages.forEach((m) => aiRenderMessage(m.role, m.content));
    } catch (err) {
      // Erro silencioso — se não der pra carregar, só mantém a tela vazia.
      console.error('Falha ao carregar histórico do assistente', err);
    }
  }

  async function aiSendMessage(message) {
    if (!message || state.aiLoading) return;
    state.aiLoading = true;
    aiChatSend.disabled = true;
    aiChatInput.disabled = true;
    $('#ai-chat-status').textContent = 'Pensando...';

    aiRenderMessage('user', message);
    const typing = aiShowTyping();

    try {
      const { answer } = await api('/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ message }),
      });
      typing.remove();
      aiRenderMessage('assistant', answer || 'Desculpe, não consegui processar agora.');
    } catch (err) {
      typing.remove();
      aiRenderMessage(
        'assistant',
        'Ops, tive um problema para responder agora. Tente novamente em instantes.'
      );
      toast(err.message, 'error');
    } finally {
      state.aiLoading = false;
      aiChatSend.disabled = false;
      aiChatInput.disabled = false;
      $('#ai-chat-status').textContent = 'Pronto para ajudar';
      aiChatInput.focus();
    }
  }

  aiChatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const val = aiChatInput.value.trim();
    if (!val) return;
    aiChatInput.value = '';
    aiSendMessage(val);
  });

  // Botões de sugestão na tela vazia.
  aiChatBody.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-ai-suggest]');
    if (!btn) return;
    aiSendMessage(btn.dataset.aiSuggest);
  });

  aiClearBtn.addEventListener('click', async () => {
    if (!confirm('Limpar todo o histórico de conversa com o assistente?')) return;
    try {
      await api('/api/ai/history', { method: 'DELETE' });
      aiChatBody.innerHTML = `
        <div class="ai-chat-empty">
          <p>Histórico limpo. Como posso te ajudar?</p>
          <div class="ai-chat-suggestions">
            <button type="button" class="chip" data-ai-suggest="Como cadastro um novo cliente?">Como cadastro um novo cliente?</button>
            <button type="button" class="chip" data-ai-suggest="Quantos clientes eu tenho?">Quantos clientes eu tenho?</button>
            <button type="button" class="chip" data-ai-suggest="Qual o meu saldo do mês?">Qual o meu saldo do mês?</button>
          </div>
        </div>
      `;
      toast('Histórico limpo');
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  aiInsightsBtn.addEventListener('click', async () => {
    aiInsightsBtn.disabled = true;
    const originalLabel = aiInsightsBtn.textContent;
    aiInsightsBtn.textContent = '✨ Analisando...';
    try {
      const { insights } = await api('/api/ai/insights');
      aiInsightsContent.innerHTML = aiFormatContent(insights).replace(/\n/g, '<br>');
      aiInsightsCard.classList.remove('hidden');
      aiInsightsCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      aiInsightsBtn.disabled = false;
      aiInsightsBtn.textContent = originalLabel;
    }
  });

  aiInsightsClose.addEventListener('click', () => {
    aiInsightsCard.classList.add('hidden');
  });

  // ───────── Init ─────────
  loadUser();
  loadOverview();
})();
