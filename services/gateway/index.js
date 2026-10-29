// CO2/CO3: API gateway - JWT auth, RBAC, rate limit, circuit breaker, discovery-based routing
const express = require('express');
const jwt = require('jsonwebtoken');
const { setup, callService, log } = require('../../shared');
const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const USERS = { inspector1: ['pass123', 'inspector'], engineer1: ['pass123', 'engineer'], manager1: ['pass123', 'manager'] };
const app = express(); app.use(express.json()); setup(app, 'gateway');

// Simple per-IP rate limit: 100 req/min (health/metrics exempt)
const hits = new Map();
app.use((q, r, n) => {
  if (q.path === '/health' || q.path === '/metrics') return n();
  const k = q.ip, now = Date.now(), w = (hits.get(k) || []).filter((t) => now - t < 60000);
  w.push(now); hits.set(k, w);
  w.length > 100 ? r.status(429).json({ error: 'rate limit exceeded' }) : n();
});

app.post('/auth/login', (q, r) => {
  const { username, password } = q.body || {};
  const u = USERS[username];
  if (!u || u[0] !== password) return r.status(401).json({ error: 'invalid credentials' });
  r.json({ token: jwt.sign({ sub: username, role: u[1] }, SECRET, { expiresIn: '1h' }) });
});

const auth = (q, r, n) => {
  try { q.user = jwt.verify((q.headers.authorization || '').replace('Bearer ', ''), SECRET); n(); }
  catch { r.status(401).json({ error: 'missing or invalid token' }); }
};
// RBAC: [method, path regex, allowed roles]
const ACL = [
  ['POST', /^\/inspections$/, ['inspector', 'manager']],
  ['GET', /^\/inspections/, ['inspector', 'engineer', 'manager']],
  ['POST', /^\/dispositions\/evaluate$/, ['engineer', 'manager']],
  ['GET', /^\/dispositions$/, ['inspector', 'engineer', 'manager']],
  ['POST', /^\/dispositions\/\d+\/approve$/, ['manager']],
];
const ROUTES = { '/inspections': 'inspection-service', '/dispositions': 'disposition-service' };

// Circuit breaker: 3 consecutive failures -> open for 10s
const cb = {};
app.use('/api', auth, async (q, r) => {
  const path = q.url, rule = ACL.find(([m, re]) => m === q.method && re.test(path));
  if (!rule) return r.status(404).json({ error: 'no such route' });
  if (!rule[2].includes(q.user.role)) return r.status(403).json({ error: `role ${q.user.role} not allowed` });
  const svc = ROUTES[Object.keys(ROUTES).find((p) => path.startsWith(p))];
  const s = (cb[svc] ||= { fails: 0, openUntil: 0 });
  if (Date.now() < s.openUntil) return r.status(503).json({ error: `circuit open for ${svc}` });
  try {
    const out = await callService(svc, path, {
      method: q.method, body: q.method === 'POST' ? q.body : undefined, cid: q.cid,
      headers: { 'x-user': q.user.sub, 'x-role': q.user.role },
    });
    s.fails = 0; r.status(out.status).json(out.data);
  } catch (e) {
    if (++s.fails >= 3) { s.openUntil = Date.now() + 10000; log('gateway', 'warn', 'circuit opened', { svc }); }
    r.status(503).json({ error: `${svc} unavailable`, detail: e.message });
  }
});

module.exports = app;
if (require.main === module) app.listen(8080, () => console.log('gateway on 8080'));
