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
  const history = await readHistory();
  // entry should have id, prompt, code, timestamp, status, executionTime, output, error
  const newEntry = {
    id: entry.id || Date.now().toString(),
    prompt: entry.prompt || '',
    code: entry.code || '',
    stdin: entry.stdin || '',
    timestamp: entry.timestamp || new Date().toISOString(),
    status: entry.status || 'Success',
    executionTime: entry.executionTime || 0,
    output: entry.output || '',
    error: entry.error || '',
    engine: entry.engine || '',
    fileName: entry.fileName || '',
    linesCount: entry.linesCount || 0
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

module.exports = {
  readHistory,
  writeHistory,
  addHistoryEntry,
  deleteHistoryEntry,
  clearHistory
};
