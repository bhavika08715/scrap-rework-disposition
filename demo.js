// Node version of demo.sh (works in Windows cmd). Run: node demo.js
const G = 'http://localhost:8080';
const show = (title) => console.log(`\n=== ${title}`);
const call = async (method, path, token, body) => {
  const r = await fetch(G + path, {
    method, headers: { 'content-type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  console.log(`${method} ${path} -> ${r.status}`); console.log(JSON.stringify(data, null, 2));
  return data;
};
const login = async (u) => (await call('POST', '/auth/login', null, { username: u, password: 'pass123' })).token;

(async () => {
  show('1. No token => 401'); await call('GET', '/api/inspections');
  show('Logging in as inspector, engineer, manager');
  const ins = await login('inspector1'), eng = await login('engineer1'), mgr = await login('manager1');

  show('2. Inspector logs a scratch (cheap rework)');
  const a = await call('POST', '/api/inspections', ins, { partNo: 'P-100', defectType: 'surface_scratch', severity: 2, unitValue: 100, quantity: 10 });
  show('3. Inspector logs a cracked high-value batch');
  const b = await call('POST', '/api/inspections', ins, { partNo: 'P-200', defectType: 'crack', severity: 3, unitValue: 5000, quantity: 5 });

  show('4. Engineer evaluates both (expect REWORK, then SCRAP pending approval)');
  await call('POST', '/api/dispositions/evaluate', eng, { inspectionId: a.id });
  const d2 = await call('POST', '/api/dispositions/evaluate', eng, { inspectionId: b.id });

  show('5. Inspector tries to approve => 403');
  await call('POST', `/api/dispositions/${d2.id}/approve`, ins);
  show('6. Manager approves the scrap');
  await call('POST', `/api/dispositions/${d2.id}/approve`, mgr);
  show('7. All dispositions'); await call('GET', '/api/dispositions', mgr);
})();
