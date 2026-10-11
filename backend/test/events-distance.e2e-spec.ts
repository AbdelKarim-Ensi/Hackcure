import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { dataSourceOptions } from '../src/database/data-source';
import { CrtEvent, EventRegistration } from '../src/database/entities/events.entities';
import { EventsService } from '../src/events/events.service';
import { addDays, iso } from '../src/rules';

// Nécessite : docker compose up -d (PostGIS) + npm run migration:run.
// Les données créées portent le préfixe [F4TEST] / +216999 et sont supprimées à la fin.
const TAG = '[F4TEST]';
const PHONE = '+216999';
jest.setTimeout(30000);

const near = (actual: number | null | undefined, expected: number) =>
  expect(Math.abs((actual as number) - expected)).toBeLessThanOrEqual(0.2);

describe('GET /events : distance donneur -> événement (PostGIS)', () => {
  let ds: DataSource;
  let service: EventsService;
  let organizer: string;
  let donorTunis: string;
  let donorNoPos: string;

  const mkUser = async (role: string, phone: string): Promise<string> => {
    const [u] = await ds.query(
      `INSERT INTO users (role, phone, password_hash, phone_verified) VALUES ($1, $2, 'x', true) RETURNING id`,
      [role, phone],
    );
    return u.id;
  };
  const mkDonor = async (userId: string, pos?: [number, number]) => {
    if (pos) {
      await ds.query(
        `INSERT INTO donors (user_id, blood_group, position, max_radius_km)
         VALUES ($1, 'O+', ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, 20)`,
        [userId, pos[1], pos[0]],
      );
    } else {
      await ds.query(`INSERT INTO donors (user_id, blood_group, max_radius_km) VALUES ($1, 'O+', 20)`, [userId]);
    }
  };
  const mkEvent = async (name: string, pos: [number, number] | null, inDays: number) => {
    const date = iso(addDays(new Date(), inDays));
    const slots = `'[{"time":"09:00","capacity":20}]'::jsonb`;
    if (pos) {
      await ds.query(
        `INSERT INTO events (organizer_id, title, place_name, position, event_date, slots, capacity)
         VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($4, $5), 4326)::geography, $6, ${slots}, 30)`,
        [organizer, `${TAG} ${name}`, name, pos[1], pos[0], date],
      );
    } else {
      await ds.query(
        `INSERT INTO events (organizer_id, title, place_name, event_date, slots, capacity)
         VALUES ($1, $2, $3, $4, ${slots}, 30)`,
        [organizer, `${TAG} ${name}`, name, date],
      );
    }
  };
  const clean = async () => {
    await ds.query(`DELETE FROM events WHERE title LIKE $1`, [`${TAG}%`]);
    await ds.query(`DELETE FROM users WHERE phone LIKE $1`, [`${PHONE}%`]);
  };
  const mine = async (donorId: string, q: Record<string, unknown> = {}) => {
    const res = await service.list(q, { id: donorId, role: 'donneur' as never, institutionId: null });
    return res.filter((e) => e.title.startsWith(TAG));
  };

  beforeAll(async () => {
    ds = new DataSource(dataSourceOptions);
    await ds.initialize();
    service = new EventsService(
      ds.getRepository(CrtEvent),
      ds.getRepository(EventRegistration),
      ds,
      {} as never,
      {} as never,
    );
    await clean();
    organizer = await mkUser('crt', `${PHONE}0001`);
    donorTunis = await mkUser('donneur', `${PHONE}0002`);
    donorNoPos = await mkUser('donneur', `${PHONE}0003`);
    await mkDonor(donorTunis, [36.8065, 10.1815]); // Tunis centre
    await mkDonor(donorNoPos);
    await mkEvent('Ariana', [36.8665, 10.1647], 7);
    await mkEvent('La Marsa', [36.8782, 10.3247], 8);
    await mkEvent('Sfax', [34.7406, 10.7603], 9);
    await mkEvent('Sans position', null, 10);
  });

  afterAll(async () => {
    await clean();
    await ds.destroy();
  });

  it('rayon 20 km : Ariana puis La Marsa puis sans position ; Sfax absent', async () => {
    const res = await mine(donorTunis);
    expect(res.map((e) => e.placeName)).toEqual(['Ariana', 'La Marsa', 'Sans position']);
    near(res[0].distanceKm, 6.8);
    near(res[1].distanceKm, 15.0);
    expect(res[2].distanceKm).toBeNull();
  });

  it('plafond à 100 km : Sfax (≈ 235 km) reste absent même avec radiusKm=300', async () => {
    const res = await mine(donorTunis, { radiusKm: 300 });
    expect(res.map((e) => e.placeName)).not.toContain('Sfax');
  });

  it('donneur sans position : tous les événements, distanceKm null', async () => {
    const res = await mine(donorNoPos);
    expect(res.map((e) => e.placeName)).toEqual(['Ariana', 'La Marsa', 'Sfax', 'Sans position']);
    expect(res.every((e) => e.distanceKm === null)).toBe(true);
  });

  it('seatsLeft = capacité moins inscriptions', async () => {
    const res = await mine(donorTunis);
    expect(res.every((e) => e.seatsLeft === 30)).toBe(true);
  });
});
