// store.js — Data layer using localStorage
const STORE_VERSION = 1;
const KEYS = {
  tasks: 'tt_tasks',
  goals: 'tt_goals',
  settings: 'tt_settings',
  version: 'tt_version',
};

const Store = {
  init() {
    if (!localStorage.getItem(KEYS.version)) {
      localStorage.setItem(KEYS.version, STORE_VERSION);
    }
    // Purge old archived tasks on launch
    this.purgeArchive();
  },

  // --- Tasks ---
  getTasks() {
    try {
      return JSON.parse(localStorage.getItem(KEYS.tasks) || '[]');
    } catch { return []; }
  },
  saveTasks(tasks) {
    localStorage.setItem(KEYS.tasks, JSON.stringify(tasks));
  },
  getOpenTasks() {
    return this.getTasks().filter(t => t.status === 'open');
  },
  getArchivedTasks() {
    return this.getTasks().filter(t => t.status === 'done');
  },
  addTask(task) {
    const tasks = this.getTasks();
    tasks.push(task);
    this.saveTasks(tasks);
  },
  updateTask(id, updates) {
    const tasks = this.getTasks();
    const idx = tasks.findIndex(t => t.id === id);
    if (idx > -1) {
      tasks[idx] = { ...tasks[idx], ...updates };
      this.saveTasks(tasks);
      return tasks[idx];
    }
    return null;
  },
  deleteTask(id) {
    const tasks = this.getTasks().filter(t => t.id !== id);
    this.saveTasks(tasks);
  },
  completeTask(id) {
    return this.updateTask(id, { status: 'done', completedAt: new Date().toISOString() });
  },

  // --- Goals ---
  getGoals() {
    try {
      return JSON.parse(localStorage.getItem(KEYS.goals) || '[]');
    } catch { return []; }
  },
  saveGoals(goals) {
    localStorage.setItem(KEYS.goals, JSON.stringify(goals));
  },
  addGoal(goal) {
    const goals = this.getGoals();
    if (goals.length >= 3) return null;
    goals.push(goal);
    this.saveGoals(goals);
    return goal;
  },
  updateGoal(id, updates) {
    const goals = this.getGoals();
    const idx = goals.findIndex(g => g.id === id);
    if (idx > -1) {
      goals[idx] = { ...goals[idx], ...updates };
      this.saveGoals(goals);
    }
  },
  deleteGoal(id) {
    const goals = this.getGoals().filter(g => g.id !== id);
    this.saveGoals(goals);
    // Untag all open tasks with this goalId
    const tasks = this.getTasks();
    tasks.forEach(t => {
      if (t.goalId === id) {
        t.goalId = null;
      }
    });
    this.saveTasks(tasks);
  },

  // Goal multiplier locked to goalId — stored on goal object
  getGoalMultiplier(goalId) {
    if (!goalId) return 1.0;
    const goal = this.getGoals().find(g => g.id === goalId);
    return goal ? goal.multiplier : 1.0;
  },

  // --- Settings ---
  getSettings() {
    try {
      return JSON.parse(localStorage.getItem(KEYS.settings) || '{}');
    } catch { return {}; }
  },
  saveSetting(key, value) {
    const s = this.getSettings();
    s[key] = value;
    localStorage.setItem(KEYS.settings, JSON.stringify(s));
  },
  getSetting(key, fallback = null) {
    return this.getSettings()[key] ?? fallback;
  },

  // --- Archive purge ---
  purgeArchive() {
    const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
    const tasks = this.getTasks().filter(t => {
      if (t.status !== 'done') return true;
      return new Date(t.completedAt).getTime() > cutoff;
    });
    this.saveTasks(tasks);
  },

  // --- Export/Import ---
  exportAll() {
    return {
      version: STORE_VERSION,
      exportedAt: new Date().toISOString(),
      tasks: this.getTasks(),
      goals: this.getGoals(),
      settings: this.getSettings(),
    };
  },
  importReplace(data) {
    localStorage.setItem(KEYS.tasks, JSON.stringify(data.tasks || []));
    localStorage.setItem(KEYS.goals, JSON.stringify(data.goals || []));
    localStorage.setItem(KEYS.settings, JSON.stringify(data.settings || {}));
  },
  importMerge(data) {
    const existingTasks = this.getTasks();
    const existingGoals = this.getGoals();
    const existingIds = new Set(existingTasks.map(t => t.id));
    const existingGoalIds = new Set(existingGoals.map(g => g.id));

    // Merge goals (up to 3)
    let skippedGoals = 0;
    const incomingGoals = data.goals || [];
    for (const g of incomingGoals) {
      if (existingGoalIds.has(g.id)) continue;
      if (existingGoals.length >= 3) { skippedGoals++; continue; }
      existingGoals.push(g);
      existingGoalIds.add(g.id);
    }

    // Merge tasks
    const newGoalIds = new Set(existingGoals.map(g => g.id));
    const incomingTasks = data.tasks || [];
    for (const t of incomingTasks) {
      if (existingIds.has(t.id)) continue;
      if (t.goalId && !newGoalIds.has(t.goalId)) {
        t.goalId = null;
      }
      existingTasks.push(t);
    }

    this.saveTasks(existingTasks);
    this.saveGoals(existingGoals);
    return skippedGoals;
  },
};
