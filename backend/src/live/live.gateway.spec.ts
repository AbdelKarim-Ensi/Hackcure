import { EventEmitter } from 'node:events';
import { LiveGateway } from './live.gateway';
import { toClientEvent } from './live.serializer';

const RID = '11111111-1111-4111-8111-111111111111';
const INST = '22222222-2222-4222-8222-222222222222';
const OTHER_INST = '33333333-3333-4333-8333-333333333333';

const jwtPayload = (over: Record<string, unknown> = {}) => ({ sub: 'u1', role: 'hopital', institutionId: INST, typ: 'access', ...over });

function setup() {
  const jwt = { verifyAsync: jest.fn() };
  const config = { getOrThrow: jest.fn().mockReturnValue('secret') };
  const requests = { findOne: jest.fn() };
  const sub = Object.assign(new EventEmitter(), {
    psubscribe: jest.fn().mockResolvedValue(1),
    disconnect: jest.fn(),
  });
  const redis = { duplicate: jest.fn().mockReturnValue(sub) };
  const gateway = new LiveGateway(jwt as never, config as never, requests as never, redis as never);
  const emit = jest.fn();
  const to = jest.fn().mockReturnValue({ emit });
  gateway.server = { local: { to } } as never;
  return { gateway, jwt, requests, sub, emit, to };
}

function socket(handshake: Record<string, unknown> = {}, user?: Record<string, unknown>) {
  return {
    handshake: { auth: {}, headers: {}, ...handshake },
    data: user ? { user } : ({} as Record<string, unknown>),
    join: jest.fn().mockResolvedValue(undefined),
  };
}

describe('LiveGateway : handshake JWT (T5.3)', () => {
  it('sans token : connexion refusée', async () => {
    const { gateway, jwt } = setup();
    const next = jest.fn();
    await gateway.authenticateHandshake(socket() as never, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(jwt.verifyAsync).not.toHaveBeenCalled();
  });

  it('token valide dans auth.token : utilisateur attaché au socket', async () => {
    const { gateway, jwt } = setup();
    jwt.verifyAsync.mockResolvedValue(jwtPayload());
    const s = socket({ auth: { token: 't1' } });
    const next = jest.fn();
    await gateway.authenticateHandshake(s as never, next);
    expect(jwt.verifyAsync).toHaveBeenCalledWith('t1', { secret: 'secret' });
    expect(next).toHaveBeenCalledWith();
    expect(s.data.user).toEqual({ id: 'u1', role: 'hopital', institutionId: INST });
  });

  it('token dans le header Authorization Bearer', async () => {
    const { gateway, jwt } = setup();
    jwt.verifyAsync.mockResolvedValue(jwtPayload());
    const next = jest.fn();
    await gateway.authenticateHandshake(socket({ headers: { authorization: 'Bearer abc' } }) as never, next);
    expect(jwt.verifyAsync).toHaveBeenCalledWith('abc', { secret: 'secret' });
    expect(next).toHaveBeenCalledWith();
  });

  it('refresh token refusé', async () => {
    const { gateway, jwt } = setup();
    jwt.verifyAsync.mockResolvedValue(jwtPayload({ typ: 'refresh' }));
    const next = jest.fn();
    await gateway.authenticateHandshake(socket({ auth: { token: 't' } }) as never, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  it('token invalide ou expiré refusé', async () => {
    const { gateway, jwt } = setup();
    jwt.verifyAsync.mockRejectedValue(new Error('jwt expired'));
    const next = jest.fn();
    await gateway.authenticateHandshake(socket({ auth: { token: 't' } }) as never, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

describe('LiveGateway : join_request (T5.3)', () => {
  const hopital = { id: 'u1', role: 'hopital', institutionId: INST };

  it('socket non authentifié refusé', async () => {
    const { gateway } = setup();
    expect(await gateway.joinRequest(socket() as never, { requestId: RID })).toEqual({ ok: false, error: 'unauthorized' });
  });

  it('identifiant non UUID refusé sans requête SQL', async () => {
    const { gateway, requests } = setup();
    const res = await gateway.joinRequest(socket({}, hopital) as never, { requestId: 'abc' });
    expect(res).toEqual({ ok: false, error: 'invalid_request_id' });
    expect(requests.findOne).not.toHaveBeenCalled();
  });

  it('donneur refusé', async () => {
    const { gateway, requests } = setup();
    const s = socket({}, { id: 'd1', role: 'donneur', institutionId: null });
    expect(await gateway.joinRequest(s as never, { requestId: RID })).toEqual({ ok: false, error: 'forbidden' });
    expect(requests.findOne).not.toHaveBeenCalled();
    expect(s.join).not.toHaveBeenCalled();
  });

  it('hôpital d\'un autre établissement refusé', async () => {
    const { gateway, requests } = setup();
    requests.findOne.mockResolvedValue({ id: RID, institutionId: OTHER_INST });
    const s = socket({}, hopital);
    expect(await gateway.joinRequest(s as never, { requestId: RID })).toEqual({ ok: false, error: 'forbidden' });
    expect(s.join).not.toHaveBeenCalled();
  });

  it('hôpital propriétaire : rejoint la room de la demande', async () => {
    const { gateway, requests } = setup();
    requests.findOne.mockResolvedValue({ id: RID, institutionId: INST });
    const s = socket({}, hopital);
    expect(await gateway.joinRequest(s as never, { requestId: RID })).toEqual({ ok: true, requestId: RID });
    expect(s.join).toHaveBeenCalledWith(`request:${RID}`);
  });

  it('crt : accès à toute demande', async () => {
    const { gateway, requests } = setup();
    requests.findOne.mockResolvedValue({ id: RID, institutionId: OTHER_INST });
    const s = socket({}, { id: 'c1', role: 'crt', institutionId: null });
    expect(await gateway.joinRequest(s as never, { requestId: RID })).toEqual({ ok: true, requestId: RID });
  });

  it('demande inconnue : forbidden', async () => {
    const { gateway, requests } = setup();
    requests.findOne.mockResolvedValue(null);
    expect(await gateway.joinRequest(socket({}, hopital) as never, { requestId: RID })).toEqual({ ok: false, error: 'forbidden' });
  });
});

describe('LiveGateway : relais Redis -> room (T5.3)', () => {
  it('s\'abonne au motif live:request:* et relaie vers la bonne room', () => {
    const { gateway, sub, emit, to } = setup();
    gateway.onModuleInit();
    expect(sub.psubscribe).toHaveBeenCalledWith('live:request:*');

    const raw = JSON.stringify({ type: 'gauge', requestId: RID, accepted: 1, needed: 4, percent: 25, at: 't' });
    sub.emit('pmessage', 'live:request:*', `live:request:${RID}`, raw);

    expect(to).toHaveBeenCalledWith(`request:${RID}`);
    expect(emit).toHaveBeenCalledWith('gauge', { requestId: RID, accepted: 1, needed: 4, percent: 25, at: 't' });
  });

  it('R4 : un champ inattendu (donneur, patient) n\'est jamais relayé', () => {
    const { gateway, sub, emit } = setup();
    gateway.onModuleInit();
    const raw = JSON.stringify({ type: 'donor_en_route', requestId: RID, accepted: 2, at: 't', donorId: 'd1', patientName: 'X' });
    sub.emit('pmessage', 'live:request:*', `live:request:${RID}`, raw);
    expect(emit).toHaveBeenCalledWith('donor_en_route', { requestId: RID, accepted: 2, at: 't' });
  });

  it('wave_started relayé', () => {
    const { gateway, sub, emit } = setup();
    gateway.onModuleInit();
    const raw = JSON.stringify({ type: 'wave_started', requestId: RID, waveNumber: 2, radiusKm: 20, at: 't' });
    sub.emit('pmessage', 'live:request:*', `live:request:${RID}`, raw);
    expect(emit).toHaveBeenCalledWith('wave_started', { requestId: RID, waveNumber: 2, radiusKm: 20, at: 't' });
  });

  it('message illisible : ignoré', () => {
    const { gateway, sub, emit } = setup();
    gateway.onModuleInit();
    sub.emit('pmessage', 'live:request:*', `live:request:${RID}`, 'pas du json');
    expect(emit).not.toHaveBeenCalled();
  });
});

describe('toClientEvent (T5.3)', () => {
  it('type inconnu, y compris clé du prototype : null', () => {
    expect(toClientEvent(`live:request:${RID}`, JSON.stringify({ type: 'closed' }))).toBeNull();
    expect(toClientEvent(`live:request:${RID}`, JSON.stringify({ type: 'toString' }))).toBeNull();
  });

  it('canal hors préfixe ou tableau JSON : null', () => {
    expect(toClientEvent('autre:canal', JSON.stringify({ type: 'gauge' }))).toBeNull();
    expect(toClientEvent(`live:request:${RID}`, '[]')).toBeNull();
  });
});
