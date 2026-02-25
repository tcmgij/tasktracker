// ranking.js — Ranking formula logic
const Ranking = {
  PERSPECTIVES: ['Quick', 'Hours', 'Days', 'Importance', 'Urgency', 'Strategic'],

  score(task, perspective, G) {
    const { importance: I, urgency: U, effort: EFF, energy: EN } = task;
    switch (perspective) {
      case 'Quick':      return (I * G) + U - (1.5 * EN);
      case 'Hours':      return (I * G) + U - EN;
      case 'Days':       return (1.5 * I * G) + U - EN;
      case 'Importance': return (1.5 * I * G) + U / 2;
      case 'Urgency':    return (1.5 * U * G) + I / 2;
      case 'Strategic':  return (I * G) + U - (EFF + EN) / 2;
      default:           return 0;
    }
  },

  filter(tasks, perspective) {
    switch (perspective) {
      case 'Quick':     return tasks.filter(t => t.effort === 1);
      case 'Hours':     return tasks.filter(t => t.effort === 2);
      case 'Days':      return tasks.filter(t => t.effort === 3);
      case 'Strategic': return tasks.filter(t => t.goalId !== null);
      default:          return tasks;
    }
  },

  rank(tasks, perspective) {
    const goals = Store.getGoals();
    const goalMap = {};
    goals.forEach(g => { goalMap[g.id] = g.multiplier || 1.0; });

    const filtered = this.filter(tasks, perspective);
    return filtered
      .map(t => ({
        ...t,
        _score: this.score(t, perspective, t.goalId ? (goalMap[t.goalId] || 1.0) : 1.0),
      }))
      .sort((a, b) => {
        if (b._score !== a._score) return b._score - a._score;
        return new Date(a.createdAt) - new Date(b.createdAt);
      });
  },
};
