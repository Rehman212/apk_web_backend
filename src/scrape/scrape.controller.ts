import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { ScrapeService } from './scrape.service';

@Controller('scrape')
@UseGuards(JwtAuthGuard)
export class ScrapeController {
  constructor(private readonly scrape: ScrapeService) {}

  @Post('apk/start')
  start(
    @Body()
    body: {
      url?: string;
      limit?: number | string | null;
      urls?: string[] | string;
      mode?: 'catalog' | 'custom';
    },
  ) {
    try {
      const raw = body?.limit;
      const limit =
        raw === undefined || raw === null || raw === ''
          ? undefined
          : Number(raw);
      const urls = Array.isArray(body?.urls)
        ? body.urls
        : typeof body?.urls === 'string'
          ? body.urls.split(/\n+/)
          : body?.mode === 'custom' && body?.url
            ? [body.url]
            : undefined;
      return this.scrape.start(String(body?.url || 'https://androidapks.com/'), limit, urls);
    } catch (err) {
      throw new BadRequestException(err instanceof Error ? err.message : 'Invalid request');
    }
  }

  @Post('apk/cancel')
  cancel(@Body() body: { id?: string }) {
    try {
      return this.scrape.cancel(String(body?.id || ''));
    } catch (err) {
      throw new BadRequestException(err instanceof Error ? err.message : 'Invalid request');
    }
  }

  @Get('apk/status')
  status(@Query('id') id = '') {
    try {
      return this.scrape.status(id);
    } catch (err) {
      throw new BadRequestException(err instanceof Error ? err.message : 'Invalid request');
    }
  }

  @Get('apk/download')
  download(
    @Query('id') id = '',
    @Query('format') format = 'json',
    @Res() res: Response,
  ) {
    try {
      if (format === 'csv') {
        const csv = this.scrape.csv(id);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader(
          'Content-Disposition',
          'attachment; filename="androidapks_details.csv"',
        );
        return res.send(csv);
      }
      return res.json(this.scrape.products(id));
    } catch (err) {
      throw new BadRequestException(err instanceof Error ? err.message : 'Invalid request');
    }
  }
}
