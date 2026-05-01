/* =========================================================
   Bushy Park Farm — Vanilla JS
   Handles: nav toggle, recipes (CRUD via localStorage),
   monthly calendar with farm visit assignments.
   ========================================================= */

(function () {
  'use strict';

  /* ---------- Mobile nav toggle (all pages) ---------- */
  const navToggle = document.querySelector('.nav-toggle');
  const mainNav = document.querySelector('.main-nav');
  if (navToggle && mainNav) {
    navToggle.addEventListener('click', () => {
      const open = mainNav.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', String(open));
    });
  }

  /* ---------- Page routing by element presence ---------- */
  if (document.getElementById('recipe-form')) initRecipes();
  if (document.getElementById('cal-grid')) initCalendar();
  if (document.getElementById('join-form')) initJoin();
  if (document.getElementById('chat-app')) initChat();
})();

/* =========================================================
   Recipes
   ========================================================= */
function initRecipes() {
  const STORAGE_KEY = 'bpf.recipes.v1';

  const form = document.getElementById('recipe-form');
  const list = document.getElementById('recipes-list');
  const empty = document.getElementById('empty-state');
  const counter = document.getElementById('recipe-count');
  const search = document.getElementById('recipe-search');
  const message = document.getElementById('form-message');

  let recipes = loadRecipes();

  render();

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const title = (data.get('title') || '').toString().trim();
    const image = (data.get('image') || '').toString().trim();
    const ingredientsRaw = (data.get('ingredients') || '').toString().trim();
    const description = (data.get('description') || '').toString().trim();

    if (!title || !ingredientsRaw || !description) {
      showMessage('Please fill in title, ingredients, and description.', true);
      return;
    }

    const ingredients = ingredientsRaw
      .split(/\r?\n|,/)
      .map((s) => s.trim())
      .filter(Boolean);

    const recipe = {
      id: cryptoId(),
      title,
      image,
      ingredients,
      description,
      createdAt: Date.now(),
    };

    recipes.unshift(recipe);
    saveRecipes(recipes);
    form.reset();
    showMessage('Recipe saved.', false);
    render();
  });

  search.addEventListener('input', render);

  list.addEventListener('click', (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    const btn = target.closest('button[data-action]');
    if (!btn) return;
    const id = btn.getAttribute('data-id');
    const action = btn.getAttribute('data-action');
    if (!id) return;

    if (action === 'delete') {
      if (!confirm('Delete this recipe?')) return;
      recipes = recipes.filter((r) => r.id !== id);
      saveRecipes(recipes);
      render();
    }
  });

  function render() {
    const query = (search.value || '').toLowerCase().trim();
    const filtered = query
      ? recipes.filter((r) =>
          r.title.toLowerCase().includes(query) ||
          r.description.toLowerCase().includes(query) ||
          r.ingredients.some((i) => i.toLowerCase().includes(query))
        )
      : recipes;

    counter.textContent = `(${filtered.length})`;
    list.innerHTML = '';

    if (filtered.length === 0) {
      empty.hidden = false;
      empty.textContent = recipes.length === 0
        ? 'No recipes yet. Be the first to share one!'
        : 'No recipes match your search.';
      return;
    }
    empty.hidden = true;

    const frag = document.createDocumentFragment();
    filtered.forEach((r) => frag.appendChild(buildCard(r)));
    list.appendChild(frag);
  }

  function buildCard(r) {
    const card = document.createElement('article');
    card.className = 'recipe-card';

    const img = document.createElement('div');
    img.className = 'recipe-image';
    if (r.image) {
      img.style.backgroundImage = `url("${escapeAttr(r.image)}")`;
      img.textContent = '';
    } else {
      img.textContent = 'Recipe Image';
    }

    const body = document.createElement('div');
    body.className = 'recipe-body';

    const h3 = document.createElement('h3');
    h3.textContent = r.title;

    const meta = document.createElement('div');
    meta.className = 'recipe-meta';
    meta.textContent = formatDate(r.createdAt);

    const ul = document.createElement('ul');
    ul.className = 'recipe-ingredients';
    r.ingredients.forEach((ing) => {
      const li = document.createElement('li');
      li.textContent = ing;
      ul.appendChild(li);
    });

    const desc = document.createElement('p');
    desc.className = 'recipe-description';
    desc.textContent = r.description;

    const actions = document.createElement('div');
    actions.className = 'recipe-actions';

    const del = document.createElement('button');
    del.className = 'btn-small danger';
    del.type = 'button';
    del.textContent = 'Delete';
    del.setAttribute('data-action', 'delete');
    del.setAttribute('data-id', r.id);
    actions.appendChild(del);

    body.append(h3, meta, ul, desc, actions);
    card.append(img, body);
    return card;
  }

  function showMessage(text, isError) {
    message.textContent = text;
    message.classList.toggle('error', !!isError);
    if (!isError) {
      setTimeout(() => {
        if (message.textContent === text) message.textContent = '';
      }, 2500);
    }
  }

  function loadRecipes() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveRecipes(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }
}

/* =========================================================
   Calendar
   ========================================================= */
function initCalendar() {
  const STORAGE_KEY = 'bpf.calendar.v1';

  const grid = document.getElementById('cal-grid');
  const titleEl = document.getElementById('cal-title');
  const prevBtn = document.getElementById('cal-prev');
  const nextBtn = document.getElementById('cal-next');
  const todayBtn = document.getElementById('cal-today');

  const modal = document.getElementById('assign-modal');
  const modalDate = document.getElementById('modal-date');
  const assignForm = document.getElementById('assign-form');
  const nameInput = document.getElementById('assignee-name');
  const noteInput = document.getElementById('assignee-note');
  const removeBtn = document.getElementById('remove-assignment');

  let assignments = loadAssignments();
  let viewYear, viewMonth; // month is 0-indexed
  let activeKey = null;

  const today = new Date();
  viewYear = today.getFullYear();
  viewMonth = today.getMonth();

  render();

  prevBtn.addEventListener('click', () => {
    viewMonth--;
    if (viewMonth < 0) { viewMonth = 11; viewYear--; }
    render();
  });

  nextBtn.addEventListener('click', () => {
    viewMonth++;
    if (viewMonth > 11) { viewMonth = 0; viewYear++; }
    render();
  });

  todayBtn.addEventListener('click', () => {
    const t = new Date();
    viewYear = t.getFullYear();
    viewMonth = t.getMonth();
    render();
  });

  grid.addEventListener('click', (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    const cell = target.closest('.cal-day');
    if (!cell || cell.classList.contains('muted')) return;
    const key = cell.getAttribute('data-key');
    if (!key) return;
    openModal(key);
  });

  assignForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!activeKey) return;
    const name = nameInput.value.trim();
    if (!name) return;
    assignments[activeKey] = {
      name,
      note: noteInput.value.trim(),
    };
    saveAssignments(assignments);
    closeModal();
    render();
  });

  removeBtn.addEventListener('click', () => {
    if (!activeKey) return;
    delete assignments[activeKey];
    saveAssignments(assignments);
    closeModal();
    render();
  });

  modal.addEventListener('click', (e) => {
    const t = e.target;
    if (t instanceof HTMLElement && t.hasAttribute('data-close')) closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hidden) closeModal();
  });

  function render() {
    const monthNames = [
      'January','February','March','April','May','June',
      'July','August','September','October','November','December'
    ];
    titleEl.textContent = `${monthNames[viewMonth]} ${viewYear}`;

    grid.innerHTML = '';

    // Monday-first week. JS getDay(): Sun=0..Sat=6 → shift so Mon=0.
    const firstOfMonth = new Date(viewYear, viewMonth, 1);
    const startWeekday = (firstOfMonth.getDay() + 6) % 7;
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrev = new Date(viewYear, viewMonth, 0).getDate();

    const totalCells = Math.ceil((startWeekday + daysInMonth) / 7) * 7;
    const frag = document.createDocumentFragment();

    for (let i = 0; i < totalCells; i++) {
      const dayNum = i - startWeekday + 1;
      let cellYear = viewYear;
      let cellMonth = viewMonth;
      let cellDay = dayNum;
      let muted = false;

      if (dayNum < 1) {
        muted = true;
        cellDay = daysInPrev + dayNum;
        cellMonth = viewMonth - 1;
        if (cellMonth < 0) { cellMonth = 11; cellYear--; }
      } else if (dayNum > daysInMonth) {
        muted = true;
        cellDay = dayNum - daysInMonth;
        cellMonth = viewMonth + 1;
        if (cellMonth > 11) { cellMonth = 0; cellYear++; }
      }

      const key = isoKey(cellYear, cellMonth, cellDay);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cal-day';
      btn.setAttribute('data-key', key);

      if (muted) btn.classList.add('muted');

      const isToday =
        cellYear === today.getFullYear() &&
        cellMonth === today.getMonth() &&
        cellDay === today.getDate();
      if (isToday && !muted) btn.classList.add('today');

      const num = document.createElement('span');
      num.className = 'cal-day-number';
      num.textContent = String(cellDay);
      btn.appendChild(num);

      const a = assignments[key];
      if (a && !muted) {
        btn.classList.add('assigned');
        const nameTag = document.createElement('span');
        nameTag.className = 'cal-day-name';
        nameTag.textContent = a.name;
        nameTag.title = a.note ? `${a.name} — ${a.note}` : a.name;
        btn.appendChild(nameTag);
        if (a.note) {
          const note = document.createElement('span');
          note.className = 'cal-day-note';
          note.textContent = a.note;
          btn.appendChild(note);
        }
      }

      frag.appendChild(btn);
    }

    grid.appendChild(frag);
  }

  function openModal(key) {
    activeKey = key;
    const [y, m, d] = key.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    modalDate.textContent = date.toLocaleDateString(undefined, {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    const existing = assignments[key];
    nameInput.value = existing ? existing.name : '';
    noteInput.value = existing ? existing.note || '' : '';
    removeBtn.hidden = !existing;

    modal.hidden = false;
    setTimeout(() => nameInput.focus(), 30);
  }

  function closeModal() {
    modal.hidden = true;
    activeKey = null;
    assignForm.reset();
  }

  function loadAssignments() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  function saveAssignments(obj) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  }
}

/* =========================================================
   Join / Membership form
   ========================================================= */
function initJoin() {
  const form = document.getElementById('join-form');
  const success = document.getElementById('join-success');
  const message = document.getElementById('join-form-message');
  const resetBtn = document.getElementById('join-reset');

  const fullName = form.querySelector('#full-name');
  const email = form.querySelector('#email');
  const phone = form.querySelector('#phone');
  const radios = form.querySelectorAll('input[name="boxSize"]');
  const checks = form.querySelectorAll('input[type="checkbox"]');

  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const phoneRe = /^[+\d][\d\s\-()]{6,}$/;

  // Live clear of error state on input
  [fullName, email, phone].forEach((el) => {
    el.addEventListener('input', () => clearInvalid(el));
  });
  radios.forEach((r) => {
    r.addEventListener('change', () => {
      form.querySelectorAll('.radio-card').forEach((c) => c.classList.remove('invalid'));
    });
  });
  checks.forEach((c) => {
    c.addEventListener('change', () => c.closest('.check').classList.remove('invalid'));
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    let valid = true;
    message.textContent = '';
    message.classList.remove('error');

    if (!fullName.value.trim()) { markInvalid(fullName); valid = false; }
    if (!emailRe.test(email.value.trim())) { markInvalid(email); valid = false; }
    if (!phoneRe.test(phone.value.trim())) { markInvalid(phone); valid = false; }

    const boxChosen = Array.from(radios).some((r) => r.checked);
    if (!boxChosen) {
      form.querySelectorAll('.radio-card').forEach((c) => c.classList.add('invalid'));
      valid = false;
    }

    let allChecked = true;
    checks.forEach((c) => {
      if (!c.checked) {
        c.closest('.check').classList.add('invalid');
        allChecked = false;
      }
    });
    if (!allChecked) valid = false;

    if (!valid) {
      message.textContent = 'Please correct the highlighted fields.';
      message.classList.add('error');
      const firstBad = form.querySelector('[aria-invalid="true"], .radio-card.invalid, .check.invalid');
      if (firstBad) firstBad.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    // Success — no backend, just show confirmation
    form.hidden = true;
    success.hidden = false;
    success.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      form.reset();
      form.hidden = false;
      success.hidden = true;
      message.textContent = '';
      form.querySelectorAll('.radio-card').forEach((c) => c.classList.remove('invalid'));
      form.querySelectorAll('.check').forEach((c) => c.classList.remove('invalid'));
      [fullName, email, phone].forEach(clearInvalid);
      form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function markInvalid(el) {
    el.setAttribute('aria-invalid', 'true');
    el.classList.add('invalid');
  }
  function clearInvalid(el) {
    el.removeAttribute('aria-invalid');
    el.classList.remove('invalid');
  }
}

/* =========================================================
   Community Chat
   ========================================================= */
function initChat() {
  /* ----- Local chat data ----- */
  const STORAGE_KEY = 'bpf.chat.session.v2';
  const CHANNEL_TYPES = ['chat', 'announcements', 'tasks', 'questions'];
  const CHANNEL_ICONS = {
    chat: '#',
    announcements: '!',
    tasks: '[]',
    questions: '?',
  };
  const TASK_STATUS_LABELS = {
    todo: 'To do',
    doing: 'Doing',
    done: 'Done',
  };
  const currentUser = {
    id: 'user_sofia_admin',
    name: 'Sofia Admin',
    role: 'admin',
  };

  /* ----- Page elements ----- */
  const serverForm = document.getElementById('server-form');
  const serverNameInput = document.getElementById('server-name');
  const serverDescriptionInput = document.getElementById('server-description');
  const channelForm = document.getElementById('channel-form');
  const channelNameInput = document.getElementById('channel-name');
  const channelTypeInput = document.getElementById('channel-type');
  const messageForm = document.getElementById('message-form');
  const messageInput = document.getElementById('message-content');
  const taskFields = document.getElementById('task-fields');
  const taskTitleInput = document.getElementById('task-title');
  const taskStatusInput = document.getElementById('task-status');
  const serverList = document.getElementById('server-list');
  const channelList = document.getElementById('channel-list');
  const memberList = document.getElementById('member-list');
  const messagesList = document.getElementById('messages-list');
  const status = document.getElementById('chat-status');
  const serverTitle = document.getElementById('chat-server-title');
  const serverDescription = document.getElementById('chat-server-description');
  const channelTitle = document.getElementById('chat-channel-title');
  const roleBadge = document.getElementById('chat-role');

  let state = loadChatState();
  seedChatState();
  render();

  /* ----- Form actions ----- */
  serverForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = serverNameInput.value.trim();
    if (!name) return;
    const server = createServer(name, serverDescriptionInput.value.trim());
    state.activeServerId = server.id;
    state.activeChannelId = server.channels[0].id;
    persist();
    serverForm.reset();
    setStatus('Server created.');
    render();
  });

  channelForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const server = getActiveServer();
    if (!server) return;
    const name = channelNameInput.value.trim();
    if (!name) return;
    const type = CHANNEL_TYPES.includes(channelTypeInput.value) ? channelTypeInput.value : 'chat';
    const channel = { id: cryptoId(), serverId: server.id, name, type };
    server.channels.push(channel);
    state.activeChannelId = channel.id;
    persist();
    channelForm.reset();
    setStatus('Channel added.');
    render();
  });

  messageForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const channel = getActiveChannel();
    if (!channel) return;
    if (channel.type === 'announcements' && currentUser.role !== 'admin') {
      setStatus('Only admins can post announcements.', true);
      return;
    }

    const content = messageInput.value.trim();
    const taskTitle = taskTitleInput.value.trim();
    if (channel.type === 'tasks' && !taskTitle) {
      setStatus('Add a task title before posting.', true);
      return;
    }
    if (channel.type !== 'tasks' && !content) return;

    const message = {
      id: cryptoId(),
      channelId: channel.id,
      user: currentUser,
      content,
      timestamp: Date.now(),
    };

    if (channel.type === 'tasks') {
      message.task = {
        title: taskTitle,
        description: content,
        status: taskStatusInput.value || 'todo',
      };
    }

    state.messages.push(message);
    persist();
    messageForm.reset();
    setStatus(channel.type === 'tasks' ? 'Task posted.' : 'Message sent.');
    renderMessages();
    syncComposer();
  });

  /* ----- Sidebar and message clicks ----- */
  serverList.addEventListener('click', (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    const btn = target.closest('button[data-server-id]');
    if (!btn) return;
    const server = state.servers.find((item) => item.id === btn.getAttribute('data-server-id'));
    if (!server) return;
    state.activeServerId = server.id;
    state.activeChannelId = server.channels[0]?.id || null;
    persist();
    render();
  });

  channelList.addEventListener('click', (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    const btn = target.closest('button[data-channel-id]');
    if (!btn) return;
    state.activeChannelId = btn.getAttribute('data-channel-id');
    persist();
    render();
  });

  messagesList.addEventListener('click', (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    const deleteBtn = target.closest('button[data-message-id]');
    const replyBtn = target.closest('button[data-reply-id]');

    if (deleteBtn) {
      if (currentUser.role !== 'admin') return;
      deleteMessage(deleteBtn.getAttribute('data-message-id'));
      return;
    }

    if (replyBtn) {
      openReplyComposer(replyBtn.getAttribute('data-reply-id'));
    }
  });

  /* ----- Render functions ----- */
  function renderServers() {
    serverList.innerHTML = '';
    if (state.servers.length === 0) {
      serverList.appendChild(emptyText('No servers yet. Create one to begin.'));
      return;
    }
    state.servers.forEach((server) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chat-list-item';
      if (server.id === state.activeServerId) btn.classList.add('active');
      btn.setAttribute('data-server-id', server.id);
      btn.innerHTML = `<span>${escapeHtml(server.name)}</span><small>${server.channels.length} channels</small>`;
      serverList.appendChild(btn);
    });
  }

  function renderHeader() {
    const server = getActiveServer();
    const channel = getActiveChannel();
    roleBadge.textContent = currentUser.role;
    serverTitle.textContent = server ? server.name : 'No server selected';
    serverDescription.textContent = server ? server.description : '';
    channelTitle.textContent = channel ? `${channelIcon(channel.type)} ${channel.name}` : 'Choose a channel';
  }

  function renderChannels() {
    const server = getActiveServer();
    channelList.innerHTML = '';
    if (!server) {
      channelList.appendChild(emptyText('Select or create a server.'));
      return;
    }

    if (!state.activeChannelId && server.channels[0]) state.activeChannelId = server.channels[0].id;
    if (state.activeChannelId && !server.channels.some((channel) => channel.id === state.activeChannelId)) {
      state.activeChannelId = server.channels[0]?.id || null;
    }

    server.channels.forEach((channel) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chat-list-item';
      if (channel.id === state.activeChannelId) btn.classList.add('active');
      btn.setAttribute('data-channel-id', channel.id);
      btn.innerHTML = `<span>${channelIcon(channel.type)} ${escapeHtml(channel.name)}</span><small>${escapeHtml(channel.type)}</small>`;
      channelList.appendChild(btn);
    });
  }

  function renderMembers() {
    const server = getActiveServer();
    memberList.innerHTML = '';
    if (!server) {
      memberList.appendChild(emptyText('No active server.'));
      return;
    }
    server.members.forEach((member) => {
      const row = document.createElement('div');
      row.className = 'member-row';
      row.innerHTML = `
        <div>
          <strong>${escapeHtml(member.name)}</strong>
          <small>${escapeHtml(member.role)}</small>
        </div>
      `;
      memberList.appendChild(row);
    });
  }

  function renderMessages() {
    const channel = getActiveChannel();
    messagesList.innerHTML = '';
    if (!channel) {
      messagesList.appendChild(emptyText('Choose a channel to start.'));
      return;
    }

    const messages = state.messages.filter((message) => message.channelId === channel.id);
    if (messages.length === 0) {
      messagesList.appendChild(emptyText(emptyChannelText(channel.type)));
      return;
    }

    messages.forEach((message) => {
      if (channel.type === 'tasks') {
        messagesList.appendChild(buildTaskCard(message));
      } else if (channel.type === 'questions') {
        messagesList.appendChild(buildQuestionMessage(message));
      } else {
        messagesList.appendChild(buildStandardMessage(message, channel.type === 'announcements'));
      }
    });
    messagesList.scrollTop = messagesList.scrollHeight;
  }

  /* ----- Message builders ----- */
  function buildStandardMessage(message, featured) {
    const row = document.createElement('article');
    row.className = featured ? 'message-row announcement-row' : 'message-row';
    row.innerHTML = messageShell(message, `<p>${escapeHtml(message.content)}</p>`);
    return row;
  }

  function buildTaskCard(message) {
    const card = document.createElement('article');
    card.className = `task-card ${escapeAttr(message.task.status)}`;
    card.innerHTML = `
      <div class="task-card-head">
        <span class="task-status">${taskStatusLabel(message.task.status)}</span>
        ${adminDeleteButton(message.id)}
      </div>
      <h3>${escapeHtml(message.task.title)}</h3>
      <p>${escapeHtml(message.task.description || 'No description added.')}</p>
      <div class="message-meta">
        <strong>${escapeHtml(message.user.name)}</strong>
        <span>${formatMessageTime(message.timestamp)}</span>
      </div>
    `;
    return card;
  }

  function buildQuestionMessage(message) {
    const body = `
      <p>${escapeHtml(message.content)}</p>
      <div class="reply-list">
        ${(message.replies || []).map((reply) => `
          <div class="reply-row">
            <strong>${escapeHtml(reply.user.name)}</strong>
            <span>${escapeHtml(reply.content)}</span>
          </div>
        `).join('')}
      </div>
      <button type="button" class="btn-small reply-btn" data-reply-id="${escapeAttr(message.id)}">Reply</button>
    `;
    const row = document.createElement('article');
    row.className = 'message-row question-row';
    row.innerHTML = messageShell(message, body);
    return row;
  }

  function messageShell(message, bodyHtml) {
    return `
      <div class="message-avatar">${escapeHtml(initials(message.user.name))}</div>
      <div class="message-body">
        <div class="message-meta">
          <strong>${escapeHtml(message.user.name)}</strong>
          <span>${formatMessageTime(message.timestamp)}</span>
          ${adminDeleteButton(message.id)}
        </div>
        ${bodyHtml}
      </div>
    `;
  }

  function openReplyComposer(messageId) {
    const text = prompt('Reply to this question:');
    if (!text || !text.trim()) return;
    const message = state.messages.find((item) => item.id === messageId);
    if (!message) return;
    message.replies = message.replies || [];
    message.replies.push({
      id: cryptoId(),
      user: currentUser,
      content: text.trim(),
      timestamp: Date.now(),
    });
    persist();
    renderMessages();
  }

  function deleteMessage(messageId) {
    state.messages = state.messages.filter((message) => message.id !== messageId);
    persist();
    setStatus('Message deleted.');
    renderMessages();
  }

  /* ----- Small state helpers ----- */
  function getActiveServer() {
    return state.servers.find((server) => server.id === state.activeServerId);
  }

  function getActiveChannel() {
    const server = getActiveServer();
    return server?.channels.find((channel) => channel.id === state.activeChannelId);
  }

  function syncComposer() {
    const channel = getActiveChannel();
    const button = messageForm.querySelector('button');
    const canPost = !!channel && (channel.type !== 'announcements' || currentUser.role === 'admin');
    taskFields.hidden = channel?.type !== 'tasks';
    messageInput.disabled = !canPost;
    button.disabled = !canPost;
    messageInput.placeholder = channel ? composerPlaceholder(channel.type, canPost) : 'Choose a channel...';
    taskTitleInput.required = channel?.type === 'tasks';
    messageInput.required = channel?.type !== 'tasks';
  }

  function render() {
    normalizeActiveSelection();
    renderServers();
    renderChannels();
    renderHeader();
    renderMembers();
    renderMessages();
    syncComposer();
  }

  function emptyText(text) {
    const p = document.createElement('p');
    p.className = 'chat-empty';
    p.textContent = text;
    return p;
  }

  function createServer(name, description) {
    const serverId = cryptoId();
    const channels = [
      { id: cryptoId(), serverId, name: 'general', type: 'chat' },
      { id: cryptoId(), serverId, name: 'announcements', type: 'announcements' },
      { id: cryptoId(), serverId, name: 'tasks', type: 'tasks' },
      { id: cryptoId(), serverId, name: 'questions', type: 'questions' },
    ];
    const server = {
      id: serverId,
      name,
      description: description || 'A local community server for this browser session.',
      members: [
        currentUser,
        { id: 'user_maya', name: 'Maya Member', role: 'member' },
        { id: 'user_liam', name: 'Liam Helper', role: 'member' },
      ],
      channels,
    };
    state.servers.push(server);
    return server;
  }

  function seedChatState() {
    if (state.servers.length > 0) return;
    const server = createServer('Farm Community', 'Coordination, tasks, announcements, and questions for members.');
    state.activeServerId = server.id;
    state.activeChannelId = server.channels[0].id;
    state.messages.push({
      id: cryptoId(),
      channelId: server.channels[0].id,
      user: currentUser,
      content: 'Welcome to the local community chat.',
      timestamp: Date.now(),
    });
    persist();
  }

  function normalizeActiveSelection() {
    if (!state.servers.some((server) => server.id === state.activeServerId)) {
      state.activeServerId = state.servers[0]?.id || null;
    }
    const server = getActiveServer();
    if (server && !server.channels.some((channel) => channel.id === state.activeChannelId)) {
      state.activeChannelId = server.channels[0]?.id || null;
    }
  }

  /* ----- Storage helpers ----- */
  function loadChatState() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && Array.isArray(parsed.servers) && Array.isArray(parsed.messages)) return parsed;
    } catch {
      // Fall through to fresh state.
    }
    return { servers: [], messages: [], activeServerId: null, activeChannelId: null };
  }

  function persist() {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function setStatus(text, isError) {
    status.textContent = text || '';
    status.classList.toggle('error', !!isError);
  }

  function adminDeleteButton(messageId) {
    if (currentUser.role !== 'admin') return '';
    return `<button type="button" class="message-delete" data-message-id="${escapeAttr(messageId)}">Delete</button>`;
  }

  function channelIcon(type) {
    return CHANNEL_ICONS[type] || '#';
  }

  function composerPlaceholder(type, canPost) {
    if (!canPost) return 'Only admins can post announcements.';
    if (type === 'tasks') return 'Task description...';
    if (type === 'questions') return 'Ask a question...';
    if (type === 'announcements') return 'Post an announcement...';
    return 'Message the channel...';
  }

  function emptyChannelText(type) {
    if (type === 'tasks') return 'No tasks yet. Add the first task card.';
    if (type === 'questions') return 'No questions yet. Ask the first one.';
    if (type === 'announcements') return 'No announcements yet.';
    return 'No messages yet.';
  }

  function taskStatusLabel(status) {
    return TASK_STATUS_LABELS[status] || 'To do';
  }
}

/* =========================================================
   Helpers
   ========================================================= */
function isoKey(year, month /* 0-indexed */, day) {
  const m = String(month + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

function formatDate(ts) {
  try {
    return new Date(ts).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  } catch {
    return '';
  }
}

function escapeAttr(s) {
  return String(s).replace(/"/g, '&quot;');
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function initials(name) {
  return String(name || 'M')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

function formatMessageTime(ts) {
  try {
    return new Date(ts).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function cryptoId() {
  if (window.crypto && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}
