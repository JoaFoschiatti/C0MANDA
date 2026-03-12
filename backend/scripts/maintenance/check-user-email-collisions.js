require('dotenv').config({ quiet: true });

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const formatArray = (value) => (
  Array.isArray(value) ? value.join(', ') : String(value || '')
);

async function main() {
  const [tableInfo] = await prisma.$queryRaw`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'usuarios'
    ) AS "tableExists"
  `;

  if (!tableInfo?.tableExists) {
    console.log('Chequeo de colisiones de email omitido: la tabla usuarios todavia no existe.');
    return;
  }

  const duplicates = await prisma.$queryRaw`
    SELECT
      lower(btrim(email)) AS normalized_email,
      array_agg(id ORDER BY id) AS user_ids,
      array_agg(email ORDER BY id) AS raw_emails,
      count(*)::int AS total
    FROM usuarios
    GROUP BY lower(btrim(email))
    HAVING count(*) > 1
    ORDER BY normalized_email
  `;

  if (!duplicates.length) {
    console.log('No se detectaron colisiones case-insensitive en emails de usuarios.');
    return;
  }

  console.error('Se detectaron colisiones de email al canonicalizar usuarios:');
  duplicates.forEach((duplicate) => {
    console.error(
      `- ${duplicate.normalized_email}: ${duplicate.total} usuarios (ids: ${formatArray(duplicate.user_ids)}; emails: ${formatArray(duplicate.raw_emails)})`
    );
  });

  process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error('No se pudo validar colisiones de email:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
