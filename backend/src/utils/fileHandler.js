const fs = require('fs').promises;
const path = require('path');

const historyFilePath = path.join(__dirname, '..', '..', 'data', 'history.json');

// Helper to ensure directory exists
async function ensureDir() {
  const dir = path.dirname(historyFilePath);
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
  }
}

async function readHistory() {
  try {
    await ensureDir();
    const data = await fs.readFile(historyFilePath, 'utf8');
    return JSON.parse(data || '[]');
  } catch (err) {
    // If file doesn't exist, return empty array
    if (err.code === 'ENOENT') {
      return [];
    }
    console.error('Error reading history file:', err);
    return [];
  }
}

async function writeHistory(history) {
  try {
    await ensureDir();
    await fs.writeFile(historyFilePath, JSON.stringify(history, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error writing history file:', err);
    return false;
  }
}

async function addHistoryEntry(entry) {
  let history = await readHistory();
  let idToUse = entry.id || Date.now().toString();

  if (entry.fileName) {
    const existingIndex = history.findIndex(item => 
      item.fileName && 
      item.fileName.toLowerCase() === entry.fileName.toLowerCase()
    );
    if (existingIndex !== -1) {
      idToUse = history[existingIndex].id;
      history.splice(existingIndex, 1);
    }
  }

  const newEntry = {
    id: idToUse,
    prompt: entry.prompt || '',
    code: entry.code || '',
    stdin: entry.stdin || '',
    timestamp: entry.timestamp || new Date().toISOString(),
    status: entry.status || 'Success',
    executionTime: entry.executionTime || 0,
    memoryUsage: entry.memoryUsage || 0,
    exitCode: entry.exitCode !== undefined ? entry.exitCode : 0,
    output: entry.output || '',
    error: entry.error || '',
    engine: entry.engine || '',
    fileName: entry.fileName || '',
    linesCount: entry.linesCount || 0,
    language: entry.language || 'python'
  };
  history.unshift(newEntry); // Newest first
  await writeHistory(history);
  return newEntry;
}

async function deleteHistoryEntry(id) {
  const history = await readHistory();
  const updatedHistory = history.filter(item => item.id !== id);
  await writeHistory(updatedHistory);
  return true;
}

async function clearHistory() {
  await writeHistory([]);
  return true;
}

async function updateHistoryEntry(id, updates) {
  const history = await readHistory();
  const index = history.findIndex(item => item.id === id);
  if (index !== -1) {
    history[index] = { ...history[index], ...updates };
    await writeHistory(history);
    return history[index];
  }
  return null;
}

module.exports = {
  readHistory,
  writeHistory,
  addHistoryEntry,
  deleteHistoryEntry,
  clearHistory,
  updateHistoryEntry
};
