const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const BASE32_LOOKUP = Object.fromEntries(
  BASE32_ALPHABET.split('').map((char, index) => [char, index])
);

const encodeBase32 = (buffer) => {
  if (!Buffer.isBuffer(buffer)) {
    throw new TypeError('encodeBase32 requiere un Buffer');
  }

  let output = '';
  let bits = 0;
  let value = 0;

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
};

const decodeBase32 = (value) => {
  const normalized = String(value || '')
    .toUpperCase()
    .replace(/=+$/g, '')
    .replace(/[^A-Z2-7]/g, '');

  if (!normalized) {
    return Buffer.alloc(0);
  }

  let bits = 0;
  let current = 0;
  const bytes = [];

  for (const char of normalized) {
    const decoded = BASE32_LOOKUP[char];
    if (decoded === undefined) {
      throw new Error(`Caracter base32 invalido: ${char}`);
    }

    current = (current << 5) | decoded;
    bits += 5;

    if (bits >= 8) {
      bytes.push((current >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
};

module.exports = {
  encodeBase32,
  decodeBase32
};
