// app.js — Main entry point
document.addEventListener('DOMContentLoaded', () => {
  Store.init();

  const GOAL_COLORS = ['var(--goal-0)', 'var(--goal-1)', 'var(--goal-2)'];
  const EMPTY_MESSAGES = ['The desk is clear.', 'Focus is a gift.', 'A moment of quiet.', 'Nothing pressing right now.'];

  // --- State ---
  let currentTab = 'home';
  let currentPerspective = Store.getSetting('perspective', 'Quick');
  let expandedCardId = null;
  let editingTaskId = null; // null = new task
  let swipeState = null;

  // --- Routing ---
  function showTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
    document.getElementById(`screen-${tab}`).classList.add('active');
    document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
    if (tab === 'home') renderHome();
    if (tab === 'tasks') renderTasks();
    if (tab === 'settings') renderSettings();
  }

  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.addEventListener('click', () => showTab(btn.dataset.tab));
  });

  // --- Top nav add button ---
  document.getElementById('btn-add-top').addEventListener('click', () => openTaskModal(null));

  // --- Segmented control ---
  function renderSegControl() {
    const wrap = document.getElementById('seg-control');
    wrap.innerHTML = '';
    Ranking.PERSPECTIVES.forEach(p => {
      const btn = document.createElement('button');
      btn.className = 'seg-btn' + (p === currentPerspective ? ' active' : '');
      btn.textContent = p;
      btn.addEventListener('click', () => {
        currentPerspective = p;
        Store.saveSetting('perspective', p);
        renderSegControl();
        renderHomeList();
      });
      wrap.appendChild(btn);
    });
  }

  // --- HOME SCREEN ---
  function renderHome() {
    renderSegControl();
    renderHomeList();
  }

  function renderHomeList() {
    const container = document.getElementById('home-list');
    container.innerHTML = '';
    const tasks = Ranking.rank(Store.getOpenTasks(), currentPerspective);
    if (tasks.length === 0) {
      const msg = EMPTY_MESSAGES[Math.floor(Math.random() * EMPTY_MESSAGES.length)];
      container.innerHTML = `<div class="empty-state">${msg}</div>`;
      return;
    }
    tasks.forEach(task => container.appendChild(makeCard(task)));
  }

  function makeCard(task) {
    const goals = Store.getGoals();
    const goal = goals.find(g => g.id === task.goalId);
    const colorVar = goal ? GOAL_COLORS[goal.colorIndex] : null;

    const wrap = document.createElement('div');
    wrap.className = 'card-wrap';
    wrap.dataset.id = task.id;

    wrap.innerHTML = `
      <div class="card-swipe-bg"><span class="swipe-del-label">Delete</span></div>
      <div class="card ${expandedCardId === task.id ? 'expanded' : ''}">
        <div class="card-main">
          <button class="card-check" aria-label="Complete task" data-id="${task.id}">
            <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
              <path d="M1 5l3.5 3.5L11 1" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <div class="card-content">
            <div class="card-title">${escHtml(task.title)}</div>
            ${goal ? `<div class="card-meta"><span class="goal-dot" style="background:${colorVar}"></span><span class="goal-label">${escHtml(goal.tag)}</span></div>` : ''}
          </div>
          <span class="card-expand-icon">▾</span>
        </div>
        <div class="card-details">
          ${task.description ? `<div class="card-desc">${escHtml(task.description)}</div>` : ''}
          <div class="dims-grid">
            <div class="dim-row"><span class="dim-label">I</span>${makeDots(task.importance)}</div>
            <div class="dim-row"><span class="dim-label">U</span>${makeDots(task.urgency)}</div>
            <div class="dim-row"><span class="dim-label">Effort</span>${makeDots(task.effort)}</div>
            <div class="dim-row"><span class="dim-label">Energy</span>${makeDots(task.energy)}</div>
          </div>
        </div>
      </div>
    `;

    // Expand/collapse
    wrap.querySelector('.card-main').addEventListener('click', (e) => {
      if (e.target.closest('.card-check')) return;
      toggleCardExpand(task.id, wrap);
    });

    // Complete button
    wrap.querySelector('.card-check').addEventListener('click', (e) => {
      e.stopPropagation();
      wrap.classList.add('completing');
      setTimeout(() => {
        Store.completeTask(task.id);
        renderHomeList();
      }, 300);
    });

    // Swipe
    attachSwipe(wrap, () => {
      showConfirmDelete(() => {
        Store.deleteTask(task.id);
        renderHomeList();
      }, wrap);
    });

    return wrap;
  }

  function toggleCardExpand(id, wrap) {
    const card = wrap.querySelector('.card');
    if (expandedCardId === id) {
      expandedCardId = null;
      card.classList.remove('expanded');
    } else {
      // Collapse previous
      const prev = document.querySelector('.card.expanded');
      if (prev) prev.classList.remove('expanded');
      expandedCardId = id;
      card.classList.add('expanded');
    }
  }

  function makeDots(val) {
    let html = '<div class="dots-display">';
    for (let i = 1; i <= 3; i++) html += `<div class="dot-d ${i <= val ? 'filled' : ''}"></div>`;
    html += '</div>';
    return html;
  }

  // --- TASKS SCREEN ---
  function renderTasks() {
    const container = document.getElementById('tasks-list');
    container.innerHTML = '';
    const tasks = Store.getOpenTasks().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const goals = Store.getGoals();

    if (tasks.length === 0) {
      container.innerHTML = `<div class="empty-state">No tasks yet.</div>`;
      return;
    }

    tasks.forEach(task => {
      const goal = goals.find(g => g.id === task.goalId);
      const colorVar = goal ? GOAL_COLORS[goal.colorIndex] : null;

      const rowWrap = document.createElement('div');
      rowWrap.className = 'row-wrap';

      rowWrap.innerHTML = `
        <div class="row-swipe-bg">Delete</div>
        <div class="task-row" data-id="${task.id}">
          ${goal ? `<span class="goal-dot" style="background:${colorVar}"></span>` : ''}
          <span class="task-row-title">${escHtml(task.title)}</span>
          <span style="color:var(--text-secondary);font-size:13px">›</span>
        </div>
      `;

      rowWrap.querySelector('.task-row').addEventListener('click', () => openTaskModal(task.id));

      attachSwipe(rowWrap, () => {
        showConfirmDelete(() => {
          Store.deleteTask(task.id);
          renderTasks();
        }, rowWrap);
      }, '.task-row');

      container.appendChild(rowWrap);
    });
  }

  // --- SETTINGS SCREEN ---
  function renderSettings() {
    renderGoals();
    renderArchive();
  }

  function renderGoals() {
    const container = document.getElementById('goals-list');
    container.innerHTML = '';
    const goals = Store.getGoals();

    goals.forEach(goal => {
      const item = document.createElement('div');
      item.className = 'goal-item';
      item.innerHTML = `
        <span class="goal-color-swatch" style="background:${GOAL_COLORS[goal.colorIndex]}"></span>
        <div class="goal-info">
          <div class="goal-tag">${escHtml(goal.tag)}</div>
          ${goal.description ? `<div class="goal-desc">${escHtml(goal.description)}</div>` : ''}
        </div>
        <button class="goal-del-btn" data-id="${goal.id}" aria-label="Delete goal">✕</button>
      `;
      item.querySelector('.goal-info').addEventListener('click', () => openGoalModal(goal.id));
      item.querySelector('.goal-del-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        showDialog(
          'Delete Goal',
          `Delete "${goal.tag}"? Tasks tagged with this goal will be untagged.`,
          [
            { label: 'Cancel', cls: '' },
            { label: 'Delete', cls: 'destructive', action: () => { Store.deleteGoal(goal.id); renderSettings(); } },
          ]
        );
      });
      container.appendChild(item);
    });

    const addBtn = document.getElementById('btn-add-goal');
    if (goals.length >= 3) {
      addBtn.style.display = 'none';
    } else {
      addBtn.style.display = '';
    }
  }

  function renderArchive() {
    const container = document.getElementById('archive-list');
    container.innerHTML = '';
    const tasks = Store.getArchivedTasks().sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
    const goals = Store.getGoals();

    if (tasks.length === 0) {
      container.innerHTML = '<div style="padding:16px 0;color:var(--text-secondary);font-size:14px;font-style:italic">No completed tasks.</div>';
      return;
    }

    tasks.forEach(task => {
      const goal = goals.find(g => g.id === task.goalId);
      const colorVar = goal ? GOAL_COLORS[goal.colorIndex] : null;
      const date = new Date(task.completedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      const row = document.createElement('div');
      row.className = 'archive-row';
      row.innerHTML = `
        ${goal ? `<span class="goal-dot" style="background:${colorVar}"></span>` : ''}
        <span class="archive-title">${escHtml(task.title)}</span>
        <span class="archive-date">${date}</span>
      `;
      container.appendChild(row);
    });
  }

  // --- GOAL MODAL ---
  let editingGoalId = null;

  function openGoalModal(goalId) {
    editingGoalId = goalId;
    const goal = goalId ? Store.getGoals().find(g => g.id === goalId) : null;
    document.getElementById('goal-modal-title').textContent = goal ? 'Edit Goal' : 'New Goal';
    document.getElementById('goal-tag-input').value = goal ? goal.tag : '';
    document.getElementById('goal-desc-input').value = goal ? (goal.description || '') : '';
    openModal('goal-modal');
  }

  document.getElementById('btn-add-goal').addEventListener('click', () => openGoalModal(null));

  document.getElementById('goal-save-btn').addEventListener('click', () => {
    const tag = document.getElementById('goal-tag-input').value.trim();
    if (!tag) { document.getElementById('goal-tag-input').focus(); return; }
    const description = document.getElementById('goal-desc-input').value.trim();

    if (editingGoalId) {
      Store.updateGoal(editingGoalId, { tag, description });
    } else {
      const goals = Store.getGoals();
      if (goals.length >= 3) return;

      // Assign next available colorIndex
      const usedColors = new Set(goals.map(g => g.colorIndex));
      let colorIndex = 0;
      while (usedColors.has(colorIndex)) colorIndex++;

      // Assign multiplier based on creation order
      const multipliers = [1.5, 1.25, 1.25];
      const usedMultiplierSlots = goals.length; // 0-based: 0→1.5, 1→1.25, 2→1.25
      const multiplier = multipliers[usedMultiplierSlots] || 1.25;

      Store.addGoal({
        id: crypto.randomUUID(),
        tag,
        description,
        colorIndex,
        multiplier,
      });
    }
    closeModal('goal-modal');
    renderSettings();
  });

  document.getElementById('goal-cancel-btn').addEventListener('click', () => closeModal('goal-modal'));

  // --- TASK MODAL ---
  function openTaskModal(taskId) {
    editingTaskId = taskId;
    const task = taskId ? Store.getTasks().find(t => t.id === taskId) : null;
    document.getElementById('task-modal-title').textContent = task ? 'Edit Task' : 'New Task';
    document.getElementById('task-title-input').value = task ? task.title : '';
    document.getElementById('task-desc-input').value = task ? (task.description || '') : '';

    // Set dot ratings
    ['importance', 'urgency', 'effort', 'energy'].forEach(dim => {
      setDotRating(dim, task ? task[dim] : 1);
    });

    // Goal selector
    renderGoalSelector(task ? task.goalId : null);

    openModal('task-modal');
    document.getElementById('task-title-input').focus();
  }

  function renderGoalSelector(selectedGoalId) {
    const container = document.getElementById('task-goal-selector');
    container.innerHTML = '';
    const goals = Store.getGoals();

    const noneOpt = makeGoalOption(null, 'None', null, selectedGoalId === null);
    container.appendChild(noneOpt);

    goals.forEach(goal => {
      const opt = makeGoalOption(goal.id, goal.tag, GOAL_COLORS[goal.colorIndex], selectedGoalId === goal.id);
      container.appendChild(opt);
    });
  }

  function makeGoalOption(id, label, colorVar, selected) {
    const div = document.createElement('div');
    div.className = 'goal-option' + (selected ? ' selected' : '');
    div.dataset.goalId = id || '';
    div.innerHTML = `
      ${colorVar ? `<span class="goal-dot" style="background:${colorVar}"></span>` : '<span style="width:8px;height:8px;flex-shrink:0"></span>'}
      <span class="goal-option-label">${escHtml(label)}</span>
      <span class="goal-option-check">✓</span>
    `;
    div.addEventListener('click', () => {
      document.querySelectorAll('.goal-option').forEach(o => o.classList.remove('selected'));
      div.classList.add('selected');
    });
    return div;
  }

  // Dot rating inputs
  function setDotRating(dim, val) {
    const container = document.querySelector(`[data-dim="${dim}"]`);
    if (!container) return;
    container.querySelectorAll('.dot-r').forEach((dot, i) => {
      dot.classList.toggle('filled', i < val);
    });
    container.dataset.value = val;
  }

  function getDotRating(dim) {
    const container = document.querySelector(`[data-dim="${dim}"]`);
    return parseInt(container.dataset.value || '1');
  }

  // Initialize dot rating inputs
  document.querySelectorAll('.dot-rating[data-dim]').forEach(container => {
    container.querySelectorAll('.dot-r').forEach((dot, i) => {
      dot.addEventListener('click', () => {
        const current = parseInt(container.dataset.value || '1');
        const newVal = (i + 1 === current) ? 1 : i + 1;
        setDotRating(container.dataset.dim, newVal);
      });
    });
  });

  // Save task
  document.getElementById('task-save-btn').addEventListener('click', () => {
    const title = document.getElementById('task-title-input').value.trim();
    if (!title) { document.getElementById('task-title-input').focus(); return; }

    const selectedGoalOpt = document.querySelector('.goal-option.selected');
    const goalId = selectedGoalOpt && selectedGoalOpt.dataset.goalId ? selectedGoalOpt.dataset.goalId : null;

    const data = {
      title,
      description: document.getElementById('task-desc-input').value.trim(),
      importance: getDotRating('importance'),
      urgency: getDotRating('urgency'),
      effort: getDotRating('effort'),
      energy: getDotRating('energy'),
      goalId,
    };

    if (editingTaskId) {
      Store.updateTask(editingTaskId, data);
    } else {
      Store.addTask({
        id: crypto.randomUUID(),
        ...data,
        status: 'open',
        createdAt: new Date().toISOString(),
        completedAt: null,
      });
    }

    closeModal('task-modal');
    if (currentTab === 'home') renderHomeList();
    if (currentTab === 'tasks') renderTasks();
  });

  document.getElementById('task-cancel-btn').addEventListener('click', () => closeModal('task-modal'));

  // Enable/disable save button based on title
  document.getElementById('task-title-input').addEventListener('input', (e) => {
    document.getElementById('task-save-btn').disabled = !e.target.value.trim();
  });

  // --- DATA MANAGEMENT ---
  document.getElementById('btn-export').addEventListener('click', () => Backup.export());

  document.getElementById('btn-import').addEventListener('click', () => {
    document.getElementById('import-file-input').click();
  });

  document.getElementById('import-file-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';

    showDialog(
      'Import Backup',
      'How would you like to handle this import?',
      [
        { label: 'Cancel', cls: '' },
        {
          label: 'Merge', cls: '', action: async () => {
            try {
              const { skippedGoals } = await Backup.import(file, 'merge');
              if (skippedGoals > 0) {
                showDialog('Import Complete', `${skippedGoals} goal(s) were skipped because you already have 3 goals.`, [{ label: 'OK', cls: 'primary' }]);
              }
              if (currentTab === 'home') renderHome();
              if (currentTab === 'tasks') renderTasks();
              if (currentTab === 'settings') renderSettings();
            } catch (err) { showDialog('Import Error', err.message, [{ label: 'OK', cls: 'primary' }]); }
          }
        },
        {
          label: 'Replace All', cls: 'destructive', action: async () => {
            try {
              await Backup.import(file, 'replace');
              currentPerspective = Store.getSetting('perspective', 'Quick');
              if (currentTab === 'home') renderHome();
              if (currentTab === 'tasks') renderTasks();
              if (currentTab === 'settings') renderSettings();
            } catch (err) { showDialog('Import Error', err.message, [{ label: 'OK', cls: 'primary' }]); }
          }
        },
      ]
    );
  });

  // --- MODAL HELPERS ---
  function openModal(id) {
    const overlay = document.getElementById(id);
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeModal(id) {
    const overlay = document.getElementById(id);
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  // Close modal on backdrop click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal(overlay.id);
    });
  });

  // --- CONFIRM DELETE ---
  function showConfirmDelete(onConfirm, element) {
    // The swipe already acts as confirm — red bg reveal is step 1, 
    // but per spec the tap on the Delete button IS the confirmation.
    // So we just call onConfirm directly when the swipe delete reveal is tapped.
    // This is triggered from attachSwipe callback.
    onConfirm();
  }

  // --- DIALOG ---
  function showDialog(title, message, buttons) {
    const overlay = document.getElementById('dialog-overlay');
    overlay.querySelector('.dialog-title').textContent = title;
    overlay.querySelector('.dialog-message').textContent = message;
    const btnsEl = overlay.querySelector('.dialog-btns');
    btnsEl.innerHTML = '';
    buttons.forEach(btn => {
      const b = document.createElement('button');
      b.className = 'dialog-btn ' + (btn.cls || '');
      b.textContent = btn.label;
      b.addEventListener('click', () => {
        overlay.classList.remove('open');
        if (btn.action) btn.action();
      });
      btnsEl.appendChild(b);
    });
    overlay.classList.add('open');
  }

  // --- SWIPE TO DELETE ---
  function attachSwipe(element, onDelete, targetSelector) {
    const target = targetSelector ? element.querySelector(targetSelector) : element.querySelector('.card');
    const bg = element.querySelector('.card-swipe-bg, .row-swipe-bg');
    if (!target || !bg) return;

    let startX = 0, startY = 0, currentX = 0, isDragging = false, isHorizontal = null;
    const THRESHOLD = -80;

    target.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      isDragging = true;
      isHorizontal = null;
      target.style.transition = 'none';
    }, { passive: true });

    target.addEventListener('touchmove', (e) => {
      if (!isDragging) return;
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;

      if (isHorizontal === null) {
        if (Math.abs(dx) > Math.abs(dy) + 5) isHorizontal = true;
        else if (Math.abs(dy) > Math.abs(dx) + 5) isHorizontal = false;
        else return;
      }

      if (!isHorizontal) return;
      e.preventDefault();

      if (dx > 0) { currentX = 0; }
      else { currentX = Math.max(dx, -110); }
      target.style.transform = `translateX(${currentX}px)`;
      bg.style.opacity = Math.min(Math.abs(currentX) / 80, 1);
    }, { passive: false });

    function endSwipe() {
      if (!isDragging) return;
      isDragging = false;
      target.style.transition = '';

      if (currentX < THRESHOLD) {
        // Show delete state — snap to reveal
        target.style.transform = `translateX(-90px)`;
        bg.style.opacity = '1';
        // Tap on bg to confirm
        const handleBgClick = () => {
          bg.removeEventListener('click', handleBgClick);
          target.style.transform = '';
          bg.style.opacity = '0';
          onDelete();
        };
        bg.addEventListener('click', handleBgClick);
      } else {
        target.style.transform = '';
        bg.style.opacity = '0';
      }
      currentX = 0;
    }

    target.addEventListener('touchend', endSwipe);
    target.addEventListener('touchcancel', endSwipe);
  }

  // --- INIT ---
  showTab('home');

  // Register service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js').catch(() => {});
  }
});

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
