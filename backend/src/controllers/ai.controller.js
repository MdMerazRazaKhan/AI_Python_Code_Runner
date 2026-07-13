const fs = require('fs').promises;
const path = require('path');
const aiService = require('../services/ai.service');

const envFilePath = path.join(__dirname, '..', '..', '.env');

async function generateCode(req, res, next) {
  try {
    const { prompt } = req.body;

    if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'A valid text prompt is required.'
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: 'GEMINI_API_KEY is missing. Please add it to your backend/.env file to enable AI generation.'
      });
    }

    const result = await aiService.generatePythonCode(prompt, apiKey);

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('ai.controller.js generateCode error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'An error occurred during code generation.'
    });
  }
}

async function fixCode(req, res, next) {
  try {
    const { code, error } = req.body;

    if (!code || typeof code !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Original Python code is required.'
      });
    }

    if (error === undefined || error === null) {
      return res.status(400).json({
        success: false,
        error: 'Execution error log is required.'
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: 'GEMINI_API_KEY is missing. Please add your API key to your backend/.env file to enable AI debugging.'
      });
    }

    const result = await aiService.fixPythonCode(code, error, apiKey);

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (err) {
    console.error('ai.controller.js fixCode error:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'An error occurred during AI debug generation.'
    });
  }
}

async function getApiKeyStatus(req, res, next) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    return res.status(200).json({
      success: true,
      data: {
        isKeySet: !!(apiKey && apiKey.trim().length > 0)
      }
    });
  } catch (err) {
    console.error('getApiKeyStatus error:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to verify API key status.'
    });
  }
}

async function saveApiKey(req, res, next) {
  try {
    const { apiKey } = req.body;

    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'A non-empty API Key string is required.'
      });
    }

    const trimmedKey = apiKey.trim();

    // Read the current .env content or make it empty
    let envContent = '';
    try {
      envContent = await fs.readFile(envFilePath, 'utf8');
    } catch (e) {
      // Env file doesn't exist yet, we will create it
    }

    const newKeyLine = `GEMINI_API_KEY=${trimmedKey}`;
    let updatedEnvContent = '';

    // Simple regex or substring search to replace key line
    const regex = /^GEMINI_API_KEY=.*$/m;
    if (regex.test(envContent)) {
      updatedEnvContent = envContent.replace(regex, newKeyLine);
    } else {
      updatedEnvContent = envContent + (envContent.endsWith('\n') || envContent === '' ? '' : '\n') + newKeyLine + '\n';
    }

    // Write back to backend/.env
    await fs.writeFile(envFilePath, updatedEnvContent, 'utf8');

    // Load key in current Node process memory
    process.env.GEMINI_API_KEY = trimmedKey;

    return res.status(200).json({
      success: true,
      message: 'API Key saved and loaded successfully.'
    });
  } catch (err) {
    console.error('saveApiKey error:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to write configuration variables.'
    });
  }
}

module.exports = {
  generateCode,
  fixCode,
  getApiKeyStatus,
  saveApiKey
};
