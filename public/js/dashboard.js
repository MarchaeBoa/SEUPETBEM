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

  // ───────── Init ─────────
  loadUser();
  loadOverview();
})();
