function validateCode(code) {
  if (code === undefined || code === null) {
    return {
      isValid: false,
      error: 'Code payload is missing.'
    };
  }

  if (typeof code !== 'string') {
    return {
      isValid: false,
      error: 'Code payload must be a string.'
    };
  }

  if (code.trim().length === 0) {
    return {
      isValid: false,
      error: 'Code payload cannot be empty.'
    };
  }

  // Safety length limit (e.g., 64KB) to prevent server overload
  const MAX_LIMIT_BYTES = 64 * 1024;
  if (Buffer.byteLength(code, 'utf8') > MAX_LIMIT_BYTES) {
    return {
      isValid: false,
      error: 'Code is too large. Maximum size allowed is 64KB.'
    };
  }

  return {
    isValid: true,
    error: null
  };
}

module.exports = {
  validateCode
};
