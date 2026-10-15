import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AppsController } from './apps.controller';
import { AppsService } from './apps.service';

@Module({
  imports: [AuthModule],
  controllers: [AppsController],
  providers: [AppsService],
  exports: [AppsService],
})
export class AppsModule {}
