import { io } from 'socket.io-client';

const API = process.env.API ?? 'http://localhost:3000';
const RUNS = Number(process.env.RUNS ?? 10);
const HOSP = { phone: process.env.HOSPITAL_PHONE, password: process.env.HOSPITAL_PASSWORD };
const DON = { phone: process.env.DONOR_PHONE, password: process.env.DONOR_PASSWORD };
const REQ_BODY = JSON.parse(process.env.REQ_BODY);
const RESPOND_BODY = JSON.parse(process.env.RESPOND_BODY ?? '{"response":"je_viens"}');

const now = () => Number(process.hrtime.bigint()) / 1e6;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(method, path, token, body) {
  const r = await fetch(API + path, {
    method,
    headers: { 'content-type': 'application/json', ...(token && { authorization: `Bearer ${token}` }) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`${method} ${path} -> ${r.status} ${t}`);
  try { return JSON.parse(t); } catch { return t; }
}

const login = async ({ phone, password }) => {
  const j = await call('POST', '/auth/login', null, { phone, password });
  return j.accessToken ?? j.access_token;
};

const stats = (a) => {
  const s = [...a].sort((x, y) => x - y);
  const q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  return { n: s.length, min: s[0], p50: q(0.5), p95: q(0.95), max: s[s.length - 1] };
};

const hospTok = await login(HOSP);
const donTok = await login(DON);

const wave1 = [], realtime = [], postReq = [];

for (let i = 0; i < RUNS; i++) {
  // --- Vague 1 : POST /requests -> vague 1 visible dans GET /requests/:id/live
  const t0 = now();
  const body = { ...REQ_BODY, deadline: REQ_BODY.deadline ?? new Date(Date.now() + 2 * 3600 * 1000).toISOString() };
  const req = await call('POST', '/requests', hospTok, body);
  postReq.push(now() - t0);
  const id = req.id;

  let seen = false;
  while (now() - t0 < 15000) {
    const live = await call('GET', `/requests/${id}/live`, hospTok);
    if (/"number":1\b/.test(JSON.stringify(live))) { wave1.push(now() - t0); seen = true; break; }
    await sleep(50);
  }
  if (!seen) console.warn(`run ${i + 1}: vague 1 non détectée en 15 s`);

  // --- Temps réel : respond -> événement gauge reçu
  const socket = io(`${API}/live`, { auth: { token: hospTok }, transports: ['websocket'] });
  await new Promise((res, rej) => { socket.on('connect', res); socket.on('connect_error', rej); });
  const ack = await socket.emitWithAck('subscribe', { requestId: id });
  if (!ack?.ok) throw new Error('subscribe refusé: ' + JSON.stringify(ack));

  const gauge = new Promise((res, rej) => {
    const to = setTimeout(() => rej(new Error('gauge non reçu en 5 s')), 5000);
    socket.on('gauge', () => { clearTimeout(to); res(now()); });
  });
  const t1 = now();
  await call('POST', `/requests/${id}/respond`, donTok, RESPOND_BODY);
  realtime.push((await gauge) - t1);
  socket.close();

  console.log(`run ${i + 1}/${RUNS}  vague1=${wave1.at(-1)?.toFixed(0)} ms  gauge=${realtime.at(-1).toFixed(0)} ms`);
}

const fmt = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, +v.toFixed(0)]));
console.log('\nPOST /requests (ms)      ', fmt(stats(postReq)));
console.log('Vague 1 (ms)  cible <10000', fmt(stats(wave1)));
console.log('Gauge   (ms)  cible < 2000', fmt(stats(realtime)));
process.exit(0);
