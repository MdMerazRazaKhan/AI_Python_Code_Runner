const dockerService = require('../services/docker.service');
const fileHandler = require('../utils/fileHandler');
const { validateCode } = require('../utils/codeValidator');

// Helper to generate a unique entry ID
function generateId() {
  return Date.now().toString() + '-' + Math.random().toString(36).substring(2, 11);
}

async function executeCode(req, res, next) {
  try {
    const { code, prompt, stdin, language } = req.body;

    // Validate the incoming code payload
    const validation = validateCode(code);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: validation.error
      });
    }

    // Default timeout of 5 seconds
    const timeoutMs = 5000;

    // Execute in the sandbox
    const result = await dockerService.executeCode(code, timeoutMs, stdin, language);

    // Build the history record
    const historyEntry = {
      id: generateId(),
      prompt: prompt || '',
      code: code,
      stdin: stdin || '',
      timestamp: new Date().toISOString(),
      status: result.status,
      executionTime: result.executionTime,
      output: result.output,
      error: result.error,
      engine: result.engine,
      language: language || 'python'
    };

    // Save to the history database
    await fileHandler.addHistoryEntry(historyEntry);

    return res.status(200).json({
      success: true,
      data: historyEntry
    });
  } catch (error) {
    console.error('run.controller.js error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'An error occurred during code execution.'
    });
  }
}

async function getHistory(req, res, next) {
  try {
    const history = await fileHandler.readHistory();
    return res.status(200).json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('getHistory error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve execution history.'
    });
  }
}

async function deleteHistoryItem(req, res, next) {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'History item ID is required.'
      });
    }
    await fileHandler.deleteHistoryEntry(id);
    return res.status(200).json({
      success: true,
      message: 'History item deleted successfully.'
    });
  } catch (error) {
    console.error('deleteHistoryItem error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete execution history item.'
    });
  }
}

async function clearHistory(req, res, next) {
  try {
    await fileHandler.clearHistory();
    return res.status(200).json({
      success: true,
      message: 'Execution history cleared successfully.'
    });
  } catch (error) {
    console.error('clearHistory error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to clear execution history.'
    });
  }
}

async function updateHistoryItem(req, res, next) {
  try {
    const { id } = req.params;
    const updates = req.body;
    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'History item ID is required.'
      });
    }
    const updated = await fileHandler.updateHistoryEntry(id, updates);
    if (!updated) {
      return res.status(404).json({
        success: false,
        error: 'History item not found.'
      });
    }
    return res.status(200).json({
      success: true,
      data: updated
    });
  } catch (error) {
    console.error('updateHistoryItem error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update history item.'
    });
  }
}

async function createHistoryItem(req, res, next) {
  try {
    const { fileName, language, code } = req.body;
    const historyEntry = {
      id: generateId(),
      prompt: '',
      code: code || '',
      stdin: '',
      timestamp: new Date().toISOString(),
      status: 'New',
      executionTime: 0,
      output: '',
      error: '',
      engine: '',
      language: language || 'python',
      fileName: fileName || '',
      linesCount: code ? code.split('\n').length : 0
    };
    const newEntry = await fileHandler.addHistoryEntry(historyEntry);
    return res.status(201).json({
      success: true,
      data: newEntry
    });
  } catch (error) {
    console.error('createHistoryItem error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create history item.'
    });
  }
}

module.exports = {
  executeCode,
  getHistory,
  deleteHistoryItem,
  clearHistory,
  updateHistoryItem,
  createHistoryItem
};
