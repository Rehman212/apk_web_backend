import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ScrapeController } from './scrape.controller';
import { ScrapeService } from './scrape.service';

@Module({
  imports: [AuthModule],
  controllers: [ScrapeController],
  providers: [ScrapeService],
})
export class ScrapeModule {}
