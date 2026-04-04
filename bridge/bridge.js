const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const DEFAULT_API_BASE_URL = 'http://localhost:3001/api';
const DEFAULT_POLL_INTERVAL_MS = 2000;
const MIN_POLL_INTERVAL_MS = 500;
const DEFAULT_REQUEST_TIMEOUT_MS = 10000;
const DEFAULT_PRINT_TIMEOUT_MS = 30000;
const MAX_BACKOFF_MS = 60000;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const parseIntSafe = (value, fallback) => {
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const escapePsString = (value) => String(value).replace(/'/g, "''");

const getConfig = (env = process.env) => {
  const bridgeToken = env.BRIDGE_TOKEN;
  const printerName = env.PRINTER_NAME;

  const missing = [];
  if (!bridgeToken) missing.push('BRIDGE_TOKEN');
  if (!printerName) missing.push('PRINTER_NAME');

  const pollIntervalRaw = parseIntSafe(env.POLL_INTERVAL_MS, DEFAULT_POLL_INTERVAL_MS);
  const pollIntervalMs = Math.max(pollIntervalRaw, MIN_POLL_INTERVAL_MS);
  const requestTimeoutMs = parseIntSafe(env.REQUEST_TIMEOUT_MS, DEFAULT_REQUEST_TIMEOUT_MS);

  return {
    apiBaseUrl: env.BRIDGE_API_URL || DEFAULT_API_BASE_URL,
    bridgeSecret: bridgeToken,
    bridgeId: env.BRIDGE_ID || os.hostname(),
    printerName,
    adapter: (env.PRINT_ADAPTER || 'spooler').toLowerCase(),
    pollIntervalMs,
    requestTimeoutMs,
    missing
  };
};

const requestJson = async (url, options, context, timeoutMs, fetchImpl) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url, { ...options, signal: controller.signal });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      const suffix = body ? ` ${body}` : '';
      throw new Error(`${context}: ${response.status}${suffix}`);
    }
    return response;
  } catch (error) {
    if (error && error.name === 'AbortError') {
      throw new Error(`${context}: timeout after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
};

const hashBody = (body) => crypto
  .createHash('sha256')
  .update(body == null ? '' : String(body))
  .digest('hex');

const buildSignaturePayload = ({ method, pathname, timestamp, nonce, body }) => [
  String(method || '').toUpperCase(),
  String(pathname || ''),
  String(timestamp || ''),
  String(nonce || ''),
  hashBody(body)
].join('\n');

const createBridge = (env = process.env, deps = {}) => {
  const config = getConfig(env);
  const fetchImpl = deps.fetch || fetch;
  const spawnImpl = deps.spawn || spawn;

  const buildSignedHeaders = (method, url, bodyString = '') => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const nonce = crypto.randomBytes(16).toString('hex');
    const pathname = new URL(url).pathname;
    const signature = crypto
      .createHmac('sha256', config.bridgeSecret)
      .update(buildSignaturePayload({
        method,
        pathname,
        timestamp,
        nonce,
        body: bodyString
      }))
      .digest('hex');

    return {
      'Content-Type': 'application/json',
      'x-bridge-id': config.bridgeId,
      'x-bridge-ts': timestamp,
      'x-bridge-nonce': nonce,
      'x-bridge-signature': signature
    };
  };

  const printTimeoutMs = parseIntSafe(env.PRINT_TIMEOUT_MS, DEFAULT_PRINT_TIMEOUT_MS);

  const printWithSpooler = async (content) => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'comanda-print-'));
    const filePath = path.join(tmpDir, `job-${Date.now()}.txt`);
    const payload = content.replace(/\n/g, '\r\n');

    try {
      fs.writeFileSync(filePath, payload, 'utf8');

      const psPath = 'powershell.exe';
      const escapedFile = escapePsString(filePath);
      const escapedPrinter = escapePsString(config.printerName);
      const command = `Get-Content -Path '${escapedFile}' | Out-Printer -Name '${escapedPrinter}'`;

      await new Promise((resolve, reject) => {
        let settled = false;
        const child = spawnImpl(psPath, ['-NoProfile', '-Command', command], {
          stdio: 'inherit'
        });

        const timer = setTimeout(() => {
          if (!settled) {
            settled = true;
            child.kill();
            reject(new Error(`Print timeout after ${printTimeoutMs}ms`));
          }
        }, printTimeoutMs);

        child.on('error', (err) => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            reject(err);
          }
        });
        child.on('exit', (code) => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            if (code === 0) return resolve();
            return reject(new Error(`PowerShell exit code ${code}`));
          }
        });
      });
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  };

  const claimJobs = async () => {
    const requestBody = JSON.stringify({
      bridgeId: config.bridgeId,
      limit: 3,
      printerName: config.printerName,
      adapter: config.adapter
    });

    const response = await requestJson(`${config.apiBaseUrl}/impresion/jobs/claim`, {
      method: 'POST',
      headers: buildSignedHeaders('POST', `${config.apiBaseUrl}/impresion/jobs/claim`, requestBody),
      body: requestBody
    }, 'Claim failed', config.requestTimeoutMs, fetchImpl);

    const data = await response.json().catch(() => {
      throw new Error('Claim failed: respuesta invalida');
    });
    return data.jobs || [];
  };

  const ackJob = async (jobId) => {
    const url = `${config.apiBaseUrl}/impresion/jobs/${jobId}/ack`;
    const requestBody = JSON.stringify({ bridgeId: config.bridgeId });

    await requestJson(url, {
      method: 'POST',
      headers: buildSignedHeaders('POST', url, requestBody),
      body: requestBody
    }, 'Ack failed', config.requestTimeoutMs, fetchImpl);
  };

  const failJob = async (jobId, error) => {
    const url = `${config.apiBaseUrl}/impresion/jobs/${jobId}/fail`;
    const requestBody = JSON.stringify({ bridgeId: config.bridgeId, error });

    await requestJson(url, {
      method: 'POST',
      headers: buildSignedHeaders('POST', url, requestBody),
      body: requestBody
    }, 'Fail failed', config.requestTimeoutMs, fetchImpl);
  };

  const processJob = async (job) => {
    if (config.adapter !== 'spooler') {
      throw new Error(`Unsupported adapter: ${config.adapter}`);
    }

    await printWithSpooler(job.contenido);
  };

  const loop = async () => {
    let consecutiveErrors = 0;

    while (true) {
      try {
        const jobs = await claimJobs();
        consecutiveErrors = 0;

        if (jobs.length === 0) {
          await sleep(config.pollIntervalMs);
          continue;
        }

        for (const job of jobs) {
          try {
            await processJob(job);
            await ackJob(job.id);
            // eslint-disable-next-line no-console
            console.log(`Printed job ${job.id} (${job.tipo})`);
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error(`Failed job ${job.id}:`, error.message || error);
            await failJob(job.id, error.message || 'Print error');
          }
        }
      } catch (error) {
        consecutiveErrors += 1;
        const backoff = Math.min(config.pollIntervalMs * Math.pow(2, consecutiveErrors - 1), MAX_BACKOFF_MS);
        // eslint-disable-next-line no-console
        console.error(`Bridge loop error (attempt ${consecutiveErrors}, retry in ${backoff}ms):`, error.message || error);
        await sleep(backoff);
      }
    }
  };

  const start = () => {
    if (config.missing.length) {
      config.missing.forEach((key) => {
        // eslint-disable-next-line no-console
        console.error(`${key} is required`);
      });
      process.exit(1);
    }

    loop();
  };

  return {
    config,
    claimJobs,
    ackJob,
    failJob,
    buildSignaturePayload,
    processJob,
    printWithSpooler,
    requestJson: (url, options, context) =>
      requestJson(url, options, context, config.requestTimeoutMs, fetchImpl),
    loop,
    start
  };
};

module.exports = {
  createBridge,
  getConfig
};
