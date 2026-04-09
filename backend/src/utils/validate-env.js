const PLACEHOLDER_PATTERNS = [
  'CHANGE_THIS',
  'change_this'
];

const REQUIRED_SECRETS = [
  'JWT_SECRET',
  'PUBLIC_ORDER_JWT_SECRET',
  'ENCRYPTION_KEY',
  'MERCADOPAGO_WEBHOOK_SECRET'
];

const validateProductionSecrets = () => {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  const violations = [];

  for (const key of REQUIRED_SECRETS) {
    const value = process.env[key];
    if (!value) {
      violations.push(`${key} no esta configurado`);
      continue;
    }

    if (PLACEHOLDER_PATTERNS.some((p) => value.includes(p))) {
      violations.push(`${key} contiene un valor placeholder - debe ser reemplazado`);
    }
  }

  if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('postgres:postgres@')) {
    violations.push('DATABASE_URL usa credenciales por defecto (postgres:postgres)');
  }

  if (violations.length > 0) {
    const message = [
      '',
      '=== ERROR DE SEGURIDAD: Secrets no configurados para produccion ===',
      '',
      ...violations.map((v) => `  - ${v}`),
      '',
      'El servidor NO puede arrancar con secrets placeholder en produccion.',
      'Genera secrets seguros y configuralos en las variables de entorno.',
      ''
    ].join('\n');

    console.error(message);
    process.exit(1);
  }
};

module.exports = { validateProductionSecrets };
