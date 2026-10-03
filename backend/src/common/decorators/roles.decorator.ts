import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/** Restreint une route aux rôles listés (lu par RolesGuard). */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
