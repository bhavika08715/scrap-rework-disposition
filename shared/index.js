// Shared platform code: logging, metrics (CO2), registry client (CO3)
const client = require('prom-client');
const crypto = require('crypto');

const REGISTRY = process.env.REGISTRY_URL || 'http://localhost:8761';
client.collectDefaultMetrics();
const latency = new client.Histogram({
  name: 'http_request_duration_seconds', help: 'HTTP latency',
  labelNames: ['service', 'method', 'route', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2],
});

const log = (service, level, msg, extra = {}) =>
  console.log(JSON.stringify({ ts: new Date().toISOString(), service, level, msg, ...extra }));

// Correlation ID + structured request log + Prometheus metrics + health
function setup(app, name) {
  app.use((req, res, next) => {
    req.cid = req.headers['x-correlation-id'] || crypto.randomUUID();
    res.setHeader('x-correlation-id', req.cid);
    const end = latency.startTimer();
    res.on('finish', () => {
      const route = req.route ? (req.baseUrl || '') + req.route.path : 'other';
      end({ service: name, method: req.method, route, status: res.statusCode });
      if (req.path !== '/metrics' && req.path !== '/health')
        log(name, 'info', 'request', { cid: req.cid, method: req.method, path: req.originalUrl, status: res.statusCode });
    });
    next();
  });
  app.get('/health', (q, r) => r.json({ status: 'UP', service: name }));
  app.get('/metrics', async (q, r) => { r.set('Content-Type', client.register.contentType); r.end(await client.register.metrics()); });
}

// Self-register with the registry and send heartbeat every 5s
function register(name, port) {
  const url = `http://${process.env.SERVICE_HOST || 'localhost'}:${port}`;
  const send = () => fetch(`${REGISTRY}/register`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, url }),
  }).catch((e) => log(name, 'warn', 'registry unavailable', { err: e.message }));
  send(); setInterval(send, 5000);
}

// Discover + call another service (client-side load balancing via registry)
async function callService(name, path, { method = 'GET', body, cid, headers = {} } = {}) {
  const l = await fetch(`${REGISTRY}/lookup/${name}`);
  if (!l.ok) throw Object.assign(new Error(`no healthy instance of ${name}`), { status: 503 });
  const { url } = await l.json();
  const res = await fetch(url + path, {
    method, signal: AbortSignal.timeout(3000),
    headers: { 'content-type': 'application/json', 'x-correlation-id': cid || '', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

module.exports = { setup, register, callService, log };
