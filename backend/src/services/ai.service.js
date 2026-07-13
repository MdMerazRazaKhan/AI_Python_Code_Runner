const { GoogleGenerativeAI } = require('@google/generative-ai');

async function generatePythonCode(prompt, apiKey) {
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not defined. Please configure it in your backend/.env file.');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const systemInstruction = `
You are an expert AI Python code generator. Your job is to generate Python code based on the user's prompt.
You MUST respond with a JSON object. The JSON object must contain exactly two fields:
1. "code": A string containing the complete, valid, runable Python code. Do not wrap the code in markdown blocks. It should be a plain string.
2. "explanation": A brief, single-paragraph explanation of what the code does.
`;

  const promptText = `${systemInstruction}\n\nUser request: ${prompt}`;

  try {
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: promptText }] }],
      generationConfig: {
        responseMimeType: 'application/json',
      }
    });

    const responseText = result.response.text();
    const parsedData = JSON.parse(responseText);

    return {
      code: parsedData.code || '',
      explanation: parsedData.explanation || 'No explanation provided.'
    };
  } catch (error) {
    console.error('Gemini API error:', error);
    throw error;
  }
}

async function fixPythonCode(code, error, apiKey) {
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not defined. Please link your API key first.');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const systemInstruction = `
You are an expert Python debugging assistant. Your job is to analyze the provided Python code and its execution error/traceback, fix the code so it runs successfully without errors, and explain the fix.
You MUST respond with a JSON object. The JSON object must contain exactly two fields:
1. "code": A string containing the complete, corrected, valid, and runable Python code. Do not wrap the code in markdown blocks. It should be a plain string.
2. "explanation": A brief, single-paragraph explanation of what the bug was and how you resolved it.

Ensure the code remains complete and self-contained (all imports, data, and logic included).
DO NOT use interactive inputs (like \`input()\`).
`;

  const promptText = `
Original Code:
\`\`\`python
${code}
\`\`\`

Execution Error:
\`\`\`
${error}
\`\`\`
`;

  try {
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: promptText }] }],
      systemInstruction: systemInstruction,
      generationConfig: {
        responseMimeType: 'application/json',
      }
    });

    const responseText = result.response.text();
    const parsedData = JSON.parse(responseText);

    return {
      code: parsedData.code || '',
      explanation: parsedData.explanation || 'Fixed compile/runtime error.'
    };
  } catch (err) {
    console.error('Gemini API error during debug fix:', err);
    throw err;
  }
}

module.exports = {
  generatePythonCode,
  fixPythonCode
};
