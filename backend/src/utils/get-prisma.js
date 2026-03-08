const { prisma } = require('../db/prisma');

const getPrisma = () => prisma;

module.exports = { getPrisma };
