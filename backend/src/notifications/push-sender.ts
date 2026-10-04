// T4.6 : abstraction d'envoi push. Le FCM réel (firebase-admin) se branche ici sans toucher au service.
import { Logger } from '@nestjs/common';

export interface PushMessage {
  token: string;
  title: string;
  body: string;
  /** FCM n'accepte que des chaînes dans `data`. */
  data: Record<string, string>;
}

export interface PushSender {
  send(message: PushMessage): Promise<void>;
}

export const PUSH_SENDER = Symbol('PUSH_SENDER');

/** Mode démo : journalise au lieu d'appeler FCM. La notification reste tracée en base. */
export class LoggingPushSender implements PushSender {
  private readonly logger = new Logger('PushSender');

  async send(message: PushMessage): Promise<void> {
    this.logger.log(`[simulé] push → ${message.token.slice(0, 8)}… : ${message.title}`);
  }
}
