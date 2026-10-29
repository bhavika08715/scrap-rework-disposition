// CO1/CO3: Disposition service - calls inspection-service via registry, applies rules, stores decision
const express = require('express');
const { setup, register, callService, log } = require('../../shared');
const { pool, init } = require('../../shared/db');
const { decide } = require('./rules');
const PORT = 8082;
const app = express(); app.use(express.json()); setup(app, 'disposition-service');

app.post('/dispositions/evaluate', async (q, r) => {
  try {
    const { inspectionId } = q.body || {};
    const ins = await callService('inspection-service', `/inspections/${inspectionId}`, { cid: q.cid });
    if (ins.status !== 200) return r.status(ins.status === 404 ? 404 : 502).json({ error: 'inspection lookup failed' });
    const i = ins.data;
    const d = decide({ defectType: i.defect_type, severity: i.severity, unitValue: +i.unit_value, quantity: i.quantity });
    const status = d.requiresApproval ? 'PENDING_APPROVAL' : 'AUTO_APPROVED';
    const { rows } = await pool.query(
      `INSERT INTO dispositions(inspection_id,decision,rework_cost,scrap_loss,rationale,status,decided_by)
       VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [i.id, d.decision, d.reworkCost, d.scrapLoss, d.rationale, status, q.headers['x-user'] || 'system']);
    log('disposition-service', 'info', 'decision made', { cid: q.cid, id: rows[0].id, decision: d.decision });
    r.status(201).json(rows[0]);
  } catch (e) { r.status(e.status || 500).json({ error: e.message }); }
});
app.get('/dispositions', async (q, r) => {
  try { r.json((await pool.query('SELECT * FROM dispositions ORDER BY id DESC')).rows); } catch (e) { r.status(500).json({ error: e.message }); }
});
app.post('/dispositions/:id/approve', async (q, r) => {
  if (q.headers['x-role'] !== 'manager') return r.status(403).json({ error: 'manager role required' });
  try {
    const { rows } = await pool.query(
      `UPDATE dispositions SET status='APPROVED', approved_by=$2 WHERE id=$1 AND status='PENDING_APPROVAL' RETURNING *`,
      [q.params.id, q.headers['x-user']]);
    rows[0] ? r.json(rows[0]) : r.status(404).json({ error: 'not found or not pending' });
  } catch (e) { r.status(500).json({ error: e.message }); }
});

(async () => {
  await init(`CREATE TABLE IF NOT EXISTS dispositions(
    id SERIAL PRIMARY KEY, inspection_id INT NOT NULL, decision TEXT NOT NULL, rework_cost NUMERIC, scrap_loss NUMERIC,
    rationale TEXT, status TEXT NOT NULL, decided_by TEXT, approved_by TEXT, created_at TIMESTAMPTZ DEFAULT now())`);
  app.listen(PORT, () => { console.log('disposition-service on', PORT); register('disposition-service', PORT); });
})();
