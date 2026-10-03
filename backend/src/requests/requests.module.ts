// AJOUT : T3 - module requests (squelette)
import { Module } from '@nestjs/common';
import { RequestsController } from './requests.controller';

@Module({
  controllers: [RequestsController],
})
export class RequestsModule {}
