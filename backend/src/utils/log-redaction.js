const SENSITIVE_KEY_PATTERN = /(access[_-]?token|refresh[_-]?token|token|secret|authorization|cookie|password|api[_-]?key)/i;

const sanitizeForLogs = (value, depth = 0, seen = new WeakSet()) => {
  if (value == null) {
    return value;
  }

  if (depth > 5) {
    return '[TRUNCATED]';
  }

  if (typeof value !== 'object') {
    return value;
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack
    };
  }

  if (seen.has(value)) {
    return '[CIRCULAR]';
  }

  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForLogs(item, depth + 1, seen));
  }

  return Object.entries(value).reduce((acc, [key, currentValue]) => {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      acc[key] = '[REDACTED]';
      return acc;
    }

    acc[key] = sanitizeForLogs(currentValue, depth + 1, seen);
    return acc;
  }, {});
};

module.exports = {
  sanitizeForLogs
};
