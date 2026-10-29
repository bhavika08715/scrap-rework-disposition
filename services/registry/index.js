// CO3: Lightweight service registry (Eureka-style): register, TTL health, round-robin lookup
const express = require('express');
const { setup } = require('../../shared');
const app = express(); app.use(express.json()); setup(app, 'registry');

const TTL = 15000, services = new Map(), counters = {};
const live = (n) => [...(services.get(n) || [])].filter(([, t]) => Date.now() - t < TTL).map(([u]) => u);

app.post('/register', (q, r) => {
  const { name, url } = q.body || {};
  if (!name || !url) return r.status(400).json({ error: 'name and url required' });
  if (!services.has(name)) services.set(name, new Map());
  services.get(name).set(url, Date.now());
  r.json({ ok: true });
});
app.get('/lookup/:name', (q, r) => {
  const n = q.params.name, l = live(n);
  if (!l.length) return r.status(404).json({ error: 'no healthy instance' });
  counters[n] = (counters[n] || 0) + 1;
  r.json({ url: l[counters[n] % l.length] });
});
app.get('/services', (q, r) => r.json(Object.fromEntries([...services.keys()].map((n) => [n, live(n)]))));

module.exports = app;
if (require.main === module) app.listen(8761, () => console.log('registry on 8761'));
