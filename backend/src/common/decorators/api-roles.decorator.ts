// T3 : documentation Swagger des rôles.
// T2.3 : pose aussi les métadonnées lues par RolesGuard (via @Roles).
import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExtension,
  ApiForbiddenResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { UserRole } from '../enums';
import { ErrorResponseDto } from '../dto/error-response.dto';
import { Roles } from './roles.decorator';

export function ApiRoles(...roles: UserRole[]) {
  return applyDecorators(
    Roles(...roles),
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
