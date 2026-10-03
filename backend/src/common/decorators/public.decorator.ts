import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Route accessible sans token (JwtAuthGuard est global et refuse par défaut). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
