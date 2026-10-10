// AJOUT : T6.3 - constantes de la file de rappels d'événements (J-1, H-2).
export const EVENT_REMINDERS_QUEUE = 'event-reminders';
export const EVENT_REMINDER_JOB = 'event-reminder';
/** BullMQ plafonne le délai à 2^31 ms (~24 jours) ; au-delà, le worker replanifie le job. */
export const MAX_QUEUE_DELAY_MS = 2_000_000_000;
/** Tunisie : UTC+1 toute l'année. */
export const TUNIS_OFFSET = '+01:00';

export type ReminderKind = 'j1' | 'h2';

export interface EventReminderJob {
  registrationId: string;
  kind: ReminderKind;
  /** Horodatage (ms) auquel le rappel doit partir. */
  fireAt: number;
}
