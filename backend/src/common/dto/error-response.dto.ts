// AJOUT : T3 - format d'erreur commun à toute l'API
import { ApiProperty } from '@nestjs/swagger';

export class ErrorResponseDto {
  @ApiProperty({ example: 400 })
  statusCode!: number;

  @ApiProperty({
    description: 'Message lisible, ou liste de messages de validation',
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
    example: ['phone must be a valid phone number'],
  })
  message!: string | string[];

  @ApiProperty({ example: 'Bad Request' })
  error!: string;
}
