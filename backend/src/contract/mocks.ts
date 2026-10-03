// AJOUT : T3 - données mockées partagées par les contrôleurs squelettes.
// Elles disparaissent contrôleur par contrôleur au fil de T4 à T6.
// Les identifiants sont fixes pour que M3 et M4 puissent s'y référer dans leurs mocks.

export const MOCK_IDS = {
  donorUser: '3f1c7a52-8d0e-4b8a-9a55-1c2d3e4f5a61',
  hospitalUser: '7b9e2c10-44aa-4f3b-8d21-0a1b2c3d4e52',
  crtUser: '9c4d1e83-6b72-4a05-b1f9-5d6e7f8a9b43',
  institution: 'a1b2c3d4-0001-4aaa-8bbb-000000000001',
  institution2: 'a1b2c3d4-0002-4aaa-8bbb-000000000002',
  request: 'b2c3d4e5-0001-4bbb-9ccc-000000000001',
  event: 'c3d4e5f6-0001-4ccc-8ddd-000000000001',
  registration: 'd4e5f6a7-0001-4ddd-9eee-000000000001',
  donation: 'e5f6a7b8-0001-4eee-8fff-000000000001',
  notification: 'f6a7b8c9-0001-4fff-9000-000000000001',
} as const;

/** Hôpital Charles Nicolle, position approximative (Tunis). */
export const MOCK_HOSPITAL_POSITION = { latitude: 36.8008, longitude: 10.1697 };

export const MOCK_DONOR_POSITION = { latitude: 36.8065, longitude: 10.1815 };

export const MOCK_NOW = '2026-10-03T10:30:00.000Z';
