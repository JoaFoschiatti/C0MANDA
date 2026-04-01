const path = require('path');
const dotenv = require('dotenv');
const { createBridge } = require('./bridge');

const loadEnv = (envPath = path.join(__dirname, '.env')) => dotenv.config({ path: envPath });

const bootstrap = () => {
  loadEnv();
  createBridge().start();
};

if (require.main === module) {
  bootstrap();
}

module.exports = {
  bootstrap,
  loadEnv
};
