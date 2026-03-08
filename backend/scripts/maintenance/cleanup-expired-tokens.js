#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function cleanupExpiredTokens() {
  console.log('Starting token cleanup...');
  console.log('Timestamp:', new Date().toISOString());

  try {
    const deletedRefreshTokens = await prisma.refreshToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          {
            revokedAt: {
              not: null,
              lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
            }
          }
        ]
      }
    });

    console.log(`Deleted ${deletedRefreshTokens.count} expired/revoked refresh tokens`);
    console.log(`Summary: Deleted ${deletedRefreshTokens.count} total records`);
    console.log('Token cleanup completed successfully');
  } catch (error) {
    console.error('Error during token cleanup:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupExpiredTokens().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
