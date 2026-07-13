const API_BASE_URL = 'http://localhost:5000/api';

/**
 * Helper to handle fetch responses and parse JSON errors.
 */
async function handleResponse(response) {
  if (!response.ok) {
    let errorMessage = 'An error occurred';
    try {
      const errorData = await response.json();
      errorMessage = errorData.error || errorData.message || errorMessage;
    } catch (e) {
      errorMessage = response.statusText || errorMessage;
    }
    throw new Error(errorMessage);
  }
  
  try {
    const data = await response.json();
    return data.data || data;
  } catch (e) {
    return null;
  }
}

/**
 * Generate Python code from prompt.
 */
export async function generateCode(prompt) {
  const response = await fetch(`${API_BASE_URL}/ai/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt }),
  });
  return handleResponse(response);
}

/**
 * Fix Python code logic or syntax errors.
 */
export async function fixCode(code, error) {
  const response = await fetch(`${API_BASE_URL}/ai/fix`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ code, error }),
  });
  return handleResponse(response);
}

/**
 * Get API Key link status.
 */
export async function getApiKeyStatus() {
  const response = await fetch(`${API_BASE_URL}/ai/config/status`);
  return handleResponse(response);
}

/**
 * Link and save API Key.
 */
export async function saveApiKey(apiKey) {
  const response = await fetch(`${API_BASE_URL}/ai/config/save`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ apiKey }),
  });
  return handleResponse(response);
}

/**
 * Execute Python code.
 */
export async function executeCode(code, prompt = '') {
  const response = await fetch(`${API_BASE_URL}/run/execute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ code, prompt }),
  });
  return handleResponse(response);
}

/**
 * Retrieve execution history.
 */
export async function getHistory() {
  const response = await fetch(`${API_BASE_URL}/run/history`);
  return handleResponse(response);
}

/**
 * Delete a specific history item.
 */
export async function deleteHistoryItem(id) {
  const response = await fetch(`${API_BASE_URL}/run/history/${id}`, {
    method: 'DELETE',
  });
  return handleResponse(response);
}

/**
 * Clear the entire execution history.
 */
export async function clearHistory() {
  const response = await fetch(`${API_BASE_URL}/run/history`, {
    method: 'DELETE',
  });
  return handleResponse(response);
}
