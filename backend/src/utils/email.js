const normalizeEmail = (email) => (
  typeof email === 'string' ? email.trim().toLowerCase() : ''
);

module.exports = {
  normalizeEmail
};
