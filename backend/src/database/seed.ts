import * as argon2 from 'argon2';
import dataSource from './data-source';

if (process.env.NODE_ENV === 'production') {
  throw new Error('Seed interdit en production');
}

// PRNG déterministe : le seed donne toujours les mêmes données
function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(42);
const pick = <T>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)];
const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);

let HASH = '';
const REST_DAYS = 90;                  // indicatif, à valider avec le CNTS
const FIRST = ['Mohamed', 'Ahmed', 'Yassine', 'Amine', 'Skander', 'Oussama', 'Sarra', 'Ines', 'Mariem', 'Rim', 'Nour', 'Salma'];
const LAST = ['Ben Salah', 'Trabelsi', 'Jebali', 'Gharbi', 'Mansouri', 'Bouazizi', 'Khelifi', 'Hamdi', 'Chaabane', 'Mejri'];
const GROUPS: [string, number][] = [
  ['O+', 40], ['A+', 30], ['B+', 10], ['AB+', 5], ['O-', 6], ['A-', 5], ['B-', 2], ['AB-', 2],
];
const pickGroup = () => {
  let r = rnd() * 100;
  for (const [g, w] of GROUPS) { if ((r -= w) < 0) return g; }
  return 'O+';
};
const ALL_GROUPS = GROUPS.map(([g]) => g);

const INSTITUTIONS = [
  { name: 'Hôpital Charles Nicolle', lat: 36.803, lng: 10.169 },
  { name: 'Hôpital La Rabta', lat: 36.810, lng: 10.171 },
  { name: 'Hôpital Mongi Slim', lat: 36.878, lng: 10.325 },
];

// AJOUT : comptes démo pour M4 (établissements non validés, numéros fixes tunisiens)
const DEMO_PENDING = [
  { name: 'Clinique Démo En Attente', status: 'en_attente', phone: '+21671000401', fullName: 'Compte démo établissement en attente' },
  { name: 'Clinique Démo Rejetée', status: 'rejete', phone: '+21671000501', fullName: 'Compte démo établissement rejeté' },
];

async function main() {
  HASH = await argon2.hash(process.env.SEED_PASSWORD ?? 'Damm2026!', { type: argon2.argon2id });
  await dataSource.initialize();
  await dataSource.transaction(async (m) => {
    await m.query(`TRUNCATE audit_log, notifications, stocks, event_registrations, events, request_responses,
      request_waves, blood_requests, donations, eligibility_forms, donors, users, institutions RESTART IDENTITY CASCADE`);

    // Établissements + comptes hôpital
    const instIds: string[] = [];
    for (let i = 0; i < INSTITUTIONS.length; i++) {
      const it = INSTITUTIONS[i];
      const [inst] = await m.query(
        `INSERT INTO institutions (name, type, validation_status, position)
         VALUES ($1, 'hopital', 'valide', ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography) RETURNING id`,
        [it.name, it.lng, it.lat]);
      instIds.push(inst.id);
      await m.query(
        `INSERT INTO users (role, phone, full_name, password_hash, phone_verified, institution_id)
         VALUES ('hopital', $1, $2, $3, true, $4)`,
        [`+2160001${String(i + 1).padStart(4, '0')}`, `Personnel ${it.name}`, HASH, inst.id]);
      for (const g of ALL_GROUPS) {
        await m.query(
          `INSERT INTO stocks (institution_id, blood_group, quantity, alert_threshold) VALUES ($1, $2, $3, 10)`,
          [inst.id, g, Math.floor(rnd() * 41)]);
      }
    }

    // Admin, direction, organisateur CRT
    await m.query(`INSERT INTO users (role, phone, full_name, password_hash, phone_verified) VALUES
      ('admin', '+21600010100', 'Admin Damm', $1, true),
      ('direction', '+21600010200', 'Direction CTS', $1, true)`, [HASH]);
    const [crt] = await m.query(
      `INSERT INTO users (role, phone, full_name, password_hash, phone_verified)
       VALUES ('crt', '+21600010300', 'Organisateur CRT', $1, true) RETURNING id`, [HASH]);

    // AJOUT : le compte CRT de démo est rattaché à un établissement Croissant-Rouge validé
    // (sans ça, le guard "établissement validé" bloquerait POST /events pour ce compte)
    const [cr] = await m.query(
      `INSERT INTO institutions (name, type, validation_status, position)
       VALUES ($1, 'croissant_rouge', 'valide', ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography) RETURNING id`,
      ['Croissant-Rouge Tunisien — Comité de Tunis', 10.1815, 36.8065]);
    await m.query(`UPDATE users SET institution_id = $1 WHERE id = $2`, [cr.id, crt.id]);

    // AJOUT : comptes hopital avec établissement non validé (en_attente) et rejeté, pour tester les écrans d'état
    for (const d of DEMO_PENDING) {
      const [pi] = await m.query(
        `INSERT INTO institutions (name, type, validation_status, position)
         VALUES ($1, 'hopital', $2, ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography) RETURNING id`,
        [d.name, d.status, 10.18, 36.80]);
      await m.query(
        `INSERT INTO users (role, phone, full_name, password_hash, phone_verified, institution_id)
         VALUES ('hopital', $1, $2, $3, true, $4)`,
        [d.phone, d.fullName, HASH, pi.id]);
    }

    // 200 donneurs simulés autour de Tunis (rayon d'environ 25 km)
    const today = new Date();
    for (let i = 1; i <= 200; i++) {
      const [u] = await m.query(
        `INSERT INTO users (role, phone, full_name, password_hash, phone_verified)
         VALUES ('donneur', $1, $2, $3, true) RETURNING id`,
        [`+2160000${String(i).padStart(4, '0')}`, `${pick(FIRST)} ${pick(LAST)}`, HASH]);

      const lat = 36.8065 + (rnd() - 0.5) * 0.4;
      const lng = 10.1815 + (rnd() - 0.5) * 0.5;
      const r = rnd();
      const status = r < 0.8 ? 'eligible' : r < 0.9 ? 'temporaire' : r < 0.95 ? 'definitif' : 'en_attente';
      const reeval = status === 'temporaire' ? iso(addDays(today, 30 + Math.floor(rnd() * 120))) : null;

      // 30 % ont donné récemment (donc encore en délai de repos), 40 % il y a longtemps
      let last: string | null = null;
      let next: string | null = null;
      const d = rnd();
      if (d < 0.3) { last = iso(addDays(today, -Math.floor(rnd() * 80))); }
      else if (d < 0.7) { last = iso(addDays(today, -(100 + Math.floor(rnd() * 400)))); }
      if (last) next = iso(addDays(new Date(last), REST_DAYS));

      await m.query(
        `INSERT INTO donors (user_id, blood_group, blood_group_confirmed, sex, position, zone, available,
           eligibility_status, reeval_date, last_donation_date, next_donation_possible_date, consent_at)
         VALUES ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($5, $6), 4326)::geography, $7, $8, $9, $10, $11, $12, now())`,
        [u.id, pickGroup(), last !== null, rnd() < 0.5 ? 'homme' : 'femme', lng, lat,
         pick(['Tunis', 'Ariana', 'Ben Arous', 'La Marsa', 'Manouba']), rnd() < 0.9,
         status, reeval, last, next]);

      if (last) {
        await m.query(
          `INSERT INTO donations (donor_id, type, donated_at, place, source) VALUES ($1, 'sang_total', $2, $3, $4)`,
          [u.id, last, pick(INSTITUTIONS).name, pick(['urgence', 'evenement'])]);
      }
    }

  
    await m.query(
      `INSERT INTO events (organizer_id, title, place_name, address, position, event_date, slots, capacity, conditions)
       VALUES
       ($1, 'Collecte de sang — Centre-ville', 'Maison de la culture, Tunis', 'Tunis',
        ST_SetSRID(ST_MakePoint(10.1815, 36.8065), 4326)::geography, $2,
        '[{"time":"09:00","capacity":20},{"time":"11:00","capacity":20},{"time":"14:00","capacity":20}]'::jsonb, 60, 'Se munir d''une pièce d''identité'),
       ($1, 'Collecte de sang — Ariana', 'Mairie de l''Ariana', 'Ariana',
        ST_SetSRID(ST_MakePoint(10.1934, 36.8625), 4326)::geography, $3,
        '[{"time":"09:00","capacity":20},{"time":"14:00","capacity":20}]'::jsonb, 40, 'Être à jeun depuis moins de 4 h')`,
      [crt.id, iso(addDays(today, 7)), iso(addDays(today, 14))]);
  });
  await dataSource.destroy();
  console.log('Seed terminé : 3 établissements, 200 donneurs, 2 événements.');
  // AJOUT : récap des comptes démo ajoutés
  console.log('Comptes démo : admin +21600010100, hôpital validé +21600010001, CRT (Croissant-Rouge validé) +21600010300, hôpital en attente +21671000401, hôpital rejeté +21671000501.');
}

main().catch((e) => { console.error(e); process.exit(1); });
