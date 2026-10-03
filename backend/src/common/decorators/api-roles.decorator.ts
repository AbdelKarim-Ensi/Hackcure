// AJOUT : T3 - décorateur de documentation des rôles.
// Pour l'instant il ne fait que documenter (Swagger). En T2.3, le même décorateur
// pourra aussi poser les métadonnées lues par RolesGuard.
import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExtension,
  ApiForbiddenResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { UserRole } from '../enums';
import { ErrorResponseDto } from '../dto/error-response.dto';

export function ApiRoles(...roles: UserRole[]) {
  return applyDecorators(
    ApiBearerAuth(),
    ApiExtension('x-roles', roles),
    ApiUnauthorizedResponse({
      description: 'Token absent, invalide ou expiré',
      type: ErrorResponseDto,
    }),
    ApiForbiddenResponse({
      description: `Rôle insuffisant. Rôles autorisés : ${roles.join(', ')}`,
      type: ErrorResponseDto,
    }),
  );
}
