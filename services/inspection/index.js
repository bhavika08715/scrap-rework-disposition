// CO1: Inspection service - records defective items found on the line
const express = require('express');
const { setup, register, log } = require('../../shared');
const { pool, init } = require('../../shared/db');
const PORT = 8081;
const app = express(); app.use(express.json()); setup(app, 'inspection-service');

const DEFECTS = ['dimensional_oversize', 'surface_scratch', 'weld_porosity', 'wrong_assembly', 'crack', 'material_defect'];

app.post('/inspections', async (q, r, next) => {
  try {
    const { partNo, defectType, severity, unitValue, quantity } = q.body || {};
    if (!partNo || !DEFECTS.includes(defectType) || !(severity >= 1 && severity <= 5) || !(unitValue > 0) || !(quantity > 0))
      return r.status(400).json({ error: 'invalid payload', validDefects: DEFECTS });
    const { rows } = await pool.query(
      `INSERT INTO inspections(part_no,defect_type,severity,unit_value,quantity,inspector)
       VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
      [partNo, defectType, severity, unitValue, quantity, q.headers['x-user'] || 'system']);
    log('inspection-service', 'info', 'inspection created', { cid: q.cid, id: rows[0].id });
    r.status(201).json(rows[0]);
  } catch (e) { next(e); }
});
app.get('/inspections', async (q, r, next) => {
  try { r.json((await pool.query('SELECT * FROM inspections ORDER BY id DESC')).rows); } catch (e) { next(e); }
});
app.get('/inspections/:id', async (q, r, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM inspections WHERE id=$1', [q.params.id]);
    rows[0] ? r.json(rows[0]) : r.status(404).json({ error: 'not found' });
  } catch (e) { next(e); }
});
app.use((e, q, r, n) => { log('inspection-service', 'error', e.message, { cid: q.cid }); r.status(500).json({ error: 'internal error' }); });

(async () => {
  await init(`CREATE TABLE IF NOT EXISTS inspections(
    id SERIAL PRIMARY KEY, part_no TEXT NOT NULL, defect_type TEXT NOT NULL, severity INT NOT NULL,
    unit_value NUMERIC NOT NULL, quantity INT NOT NULL, inspector TEXT, created_at TIMESTAMPTZ DEFAULT now())`);
  app.listen(PORT, () => { console.log('inspection-service on', PORT); register('inspection-service', PORT); });
})();
