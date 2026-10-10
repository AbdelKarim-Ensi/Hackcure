import { buildAlertPayload, MAX_ATTEMPTS, NotificationsService } from './notifications.service';

const NOW = new Date('2026-10-04T12:00:00.000Z');
const alert = { requestId: 'r1', bloodGroup: 'A+', hospitalName: 'H1', distanceKm: 3.2, urgency: 'urgente', deadline: '2026-10-04T18:00:00.000Z' };

function make(opts: { token?: string | null; recent?: number; sendFails?: number } = {}) {
  const saved: any[] = [];
  const notifications = {
    create: (x: any) => ({ id: 'n1', createdAt: NOW, ...x }),
    save: async (x: any) => { saved.push({ ...x }); return x; },
    count: jest.fn(async () => opts.recent ?? 0),
    find: jest.fn(async () => []),
  };
  const users = { findOne: async () => ({ id: 'u1', fcmToken: opts.token === undefined ? 'tok-123456789' : opts.token }) };
  let calls = 0;
  const sent: any[] = [];
  const sender = {
    send: async (m: any) => {
      calls++;
      if (calls <= (opts.sendFails ?? 0)) throw new Error('FCM indisponible');
      sent.push(m);
    },
  };
  const svc = new NotificationsService(notifications as any, users as any, sender as any);
  svc.now = () => NOW;
  svc.sleep = async () => undefined;
  return { svc, saved, sent, notifications, calls: () => calls };
}

describe('buildAlertPayload (R4)', () => {
  it('écarte tout champ hors liste blanche, dont l\'identité patient', () => {
    const payload = buildAlertPayload({ ...alert, patientName: 'Jean Dupont', ward: 'Réa', medicalRecord: '123' } as any);
    expect(Object.keys(payload).sort()).toEqual(['bloodGroup', 'deadline', 'distanceKm', 'hospitalName', 'requestId', 'type', 'urgency']);
    expect(JSON.stringify(payload)).not.toMatch(/Dupont|Réa|123/);
  });
});

describe('NotificationsService', () => {
  const input = { userId: 'u1', type: 'urgence' as any, payload: buildAlertPayload(alert), requestId: 'r1' };

  it('enqueue : journalise en en_attente', async () => {
    const { svc, saved } = make();
    await svc.enqueue(input);
    expect(saved[0]).toMatchObject({ userId: 'u1', type: 'urgence', status: 'en_attente', requestId: 'r1' });
  });

  it('quota : refuse au-delà de 5 urgences sur 7 jours', async () => {
    const { svc, saved } = make({ recent: 5 });
    expect(await svc.enqueue(input)).toBeNull();
    expect(saved).toHaveLength(0);
  });

  it('quota : sous le seuil, la notification passe', async () => {
    expect(await make({ recent: 4 }).svc.enqueue(input)).not.toBeNull();
  });

  it('quota : une urgence critique n\'est jamais bloquée', async () => {
    const critical = { ...input, payload: buildAlertPayload({ ...alert, urgency: 'critique' }) };
    expect(await make({ recent: 99 }).svc.enqueue(critical)).not.toBeNull();
  });

  it('quota : les rappels ne comptent pas dans le quota d\'urgence', async () => {
    expect(await make({ recent: 99 }).svc.enqueue({ ...input, type: 'rappel' as any })).not.toBeNull();
  });

  it('dispatch : envoie, marque envoyee, data en chaînes sans identité patient', async () => {
    const { svc, sent, saved } = make();
    const n = await svc.notify(input);
    expect(n?.status).toBe('envoyee');
    expect(n?.sentAt).toEqual(NOW);
    expect(saved.at(-1).status).toBe('envoyee');
    for (const v of Object.values(sent[0].data)) expect(typeof v).toBe('string');
    expect(sent[0].data).toMatchObject({ requestId: 'r1', distanceKm: '3.2' });
    expect(JSON.stringify(sent[0])).not.toMatch(/patient/i);
  });

  it('dispatch : reprend après un échec puis réussit', async () => {
    const m = make({ sendFails: 2 });
    const n = await m.svc.notify(input);
    expect(n?.status).toBe('envoyee');
    expect(m.calls()).toBe(3);
  });

  it('dispatch : echec journalisé après toutes les reprises', async () => {
    const m = make({ sendFails: 99 });
    const n = await m.svc.notify(input);
    expect(n?.status).toBe('echec');
    expect(m.calls()).toBe(MAX_ATTEMPTS);
  });

  it('dispatch : sans jeton FCM, echec journalisé sans appel au sender', async () => {
    const m = make({ token: null });
    const n = await m.svc.notify(input);
    expect(n?.status).toBe('echec');
    expect(m.calls()).toBe(0);
  });
});
