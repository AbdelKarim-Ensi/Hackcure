import { Module } from '@nestjs/common';
import { InstitutionsModule } from '../institutions/institutions.module';
import { RequestsController } from './requests.controller';

@Module({
  imports: [InstitutionsModule],
  controllers: [RequestsController],
})
export class RequestsModule {}
