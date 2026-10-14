const { contextBridge } = require('electron');
const fs = require('fs');
const path = require('path');

function findWordsFile() {
  const names = ['en_words.txt', 'en_words'];
  const dirs = [
    __dirname,
    path.join(__dirname, '..'),
    process.resourcesPath || '',
    path.dirname(process.execPath)
  ];
  for (const d of dirs) {
    for (const n of names) {
      const p = path.join(d, n);
      try { if (fs.existsSync(p)) return p; } catch (e) {}
    }
  }
  return null;
}

contextBridge.exposeInMainWorld('gameAPI', {
  getWords: () => {
    const p = findWordsFile();
    return p ? fs.readFileSync(p, 'utf8') : '';
  }
});
