const request = require('supertest');
const registry = require('../services/registry');
const gateway = require('../services/gateway');

describe('registry', () => {
  test('register then lookup', async () => {
    await request(registry).post('/register').send({ name: 'x', url: 'http://x:1' }).expect(200);
    const r = await request(registry).get('/lookup/x').expect(200);
    expect(r.body.url).toBe('http://x:1');
  });
  test('unknown service 404', () => request(registry).get('/lookup/none').expect(404));
  test('bad register 400', () => request(registry).post('/register').send({}).expect(400));
});
describe('gateway security', () => {
  test('no token -> 401', () => request(gateway).get('/api/inspections').expect(401));
  test('bad login -> 401', () => request(gateway).post('/auth/login').send({ username: 'a', password: 'b' }).expect(401));
  test('inspector cannot approve -> 403', async () => {
    const t = (await request(gateway).post('/auth/login').send({ username: 'inspector1', password: 'pass123' })).body.token;
    await request(gateway).post('/api/dispositions/1/approve').set('Authorization', `Bearer ${t}`).expect(403);
  });
  test('health endpoint', () => request(gateway).get('/health').expect(200));
  test('metrics endpoint', async () => expect((await request(gateway).get('/metrics')).text).toContain('http_request_duration_seconds'));
});
