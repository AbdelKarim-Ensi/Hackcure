import { Donor, Institution, User } from './identity.entities';
import { Donation, EligibilityForm } from './health.entities';
import { BloodRequest, RequestResponse, RequestWave } from './requests.entities';
import { CrtEvent, EventRegistration } from './events.entities';
import { AppNotification, AuditLog, Stock } from './ops.entities';

export * from './identity.entities';
export * from './health.entities';
export * from './requests.entities';
export * from './events.entities';
export * from './ops.entities';

export const ALL_ENTITIES = [
  Institution, User, Donor, EligibilityForm, Donation,
  BloodRequest, RequestWave, RequestResponse,
  CrtEvent, EventRegistration, Stock, AppNotification, AuditLog,
];
