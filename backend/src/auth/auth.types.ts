import { UserRole } from '../database/enums';

export const ACCESS_TTL_SECONDS = 900;
export const REFRESH_TTL_SECONDS = 7 * 24 * 3600;

export interface JwtPayload {
  sub: string;
  role: UserRole;
  institutionId: string | null;
  typ: 'access' | 'refresh';
}

/** Objet attaché à req.user par JwtAuthGuard (T2.3). */
export interface AuthenticatedUser {
  id: string;
  role: UserRole;
  institutionId: string | null;
}
