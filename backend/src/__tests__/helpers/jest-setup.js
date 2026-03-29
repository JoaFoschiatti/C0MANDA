const { loadTestEnv } = require('./load-test-env');

loadTestEnv();

if (!process.env.JWT_SECRET) process.env.JWT_SECRET = 'test-secret';
if (!process.env.JWT_EXPIRES_IN) process.env.JWT_EXPIRES_IN = '1h';
