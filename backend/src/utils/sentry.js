let sentryInitialized = false;

const setupSentry = (app) => {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  try {
    const Sentry = require('@sentry/node');
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: 0.1
    });
    app.use(Sentry.Handlers.requestHandler());
    sentryInitialized = true;
  } catch (err) {
    console.error('Failed to initialize Sentry:', err.message);
  }
};

const setupSentryErrorHandler = (app) => {
  if (!sentryInitialized) return;

  try {
    const Sentry = require('@sentry/node');
    app.use(Sentry.Handlers.errorHandler());
  } catch {
    // Sentry not available
  }
};

const captureException = (error) => {
  if (!sentryInitialized) return;

  try {
    const Sentry = require('@sentry/node');
    Sentry.captureException(error);
  } catch {
    // Sentry not available
  }
};

module.exports = { setupSentry, setupSentryErrorHandler, captureException };
