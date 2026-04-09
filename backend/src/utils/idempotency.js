const crypto = require('crypto');

const IDEMPOTENCY_HEADER = 'Idempotency-Key';
const IDEMPOTENCY_HEADER_LOWER = IDEMPOTENCY_HEADER.toLowerCase();

const normalizeIdempotencyKey = (value) => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized || null;
};

const readIdempotencyKey = (req) => normalizeIdempotencyKey(
  req.get?.(IDEMPOTENCY_HEADER) ?? req.headers?.[IDEMPOTENCY_HEADER_LOWER]
);

const sortValue = (value) => {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }

  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((accumulator, key) => {
        const nestedValue = value[key];
        if (nestedValue !== undefined) {
          accumulator[key] = sortValue(nestedValue);
        }
        return accumulator;
      }, {});
  }

  return value;
};

const stableStringify = (value) => JSON.stringify(sortValue(value));

const buildIdempotentRequestHash = ({ operation, method, params, body, query }) => crypto
  .createHash('sha256')
  .update(stableStringify({
    operation,
    method,
    params: params || {},
    query: query || {},
    body: body || {}
  }))
  .digest('hex');

const buildIdempotentPrintBatchId = ({ operation, idempotencyKey }) => `idem-${crypto
  .createHash('sha256')
  .update(`${operation}:${idempotencyKey}`)
  .digest('hex')
  .slice(0, 24)}`;

module.exports = {
  IDEMPOTENCY_HEADER,
  normalizeIdempotencyKey,
  readIdempotencyKey,
  stableStringify,
  buildIdempotentRequestHash,
  buildIdempotentPrintBatchId
};
