// backup.js — Export/import logic
const Backup = {
  export() {
    const data = Store.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `task-tracker-backup-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  import(file, mode) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          if (!data.tasks || !Array.isArray(data.tasks)) {
            reject(new Error('Invalid backup file: missing tasks array.'));
            return;
          }
          if (mode === 'replace') {
            Store.importReplace(data);
            resolve({ skippedGoals: 0 });
          } else {
            const skippedGoals = Store.importMerge(data);
            resolve({ skippedGoals });
          }
        } catch (err) {
          reject(new Error('Could not parse JSON file. Please check the file is a valid Task Tracker backup.'));
        }
      };
      reader.onerror = () => reject(new Error('Could not read file.'));
      reader.readAsText(file);
    });
  },
};
