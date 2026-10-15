import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { AppsService } from './apps.service';
import { PatchApkDto, UpsertApkDto } from './dto/apk.dto';

@Controller('apps')
export class AppsController {
  constructor(private readonly apps: AppsService) {}

  /** Public home sections for storefront */
  @Get('home')
  home() {
    return this.apps.homeFeed(6);
  }

  @Get('sections')
  @UseGuards(JwtAuthGuard)
  async sections() {
    return { sections: await this.apps.sectionCounts() };
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async list() {
    const [items, count, sections] = await Promise.all([
      this.apps.list(),
      this.apps.count(),
      this.apps.sectionCounts(),
    ]);
    return { apps: items, count, sections };
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async upsert(@Body() dto: UpsertApkDto) {
    const app = await this.apps.upsert(dto);
    const count = await this.apps.count();
    return { ok: true, app, count };
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async patch(@Param('id') id: string, @Body() dto: PatchApkDto) {
    const app = await this.apps.patch(id, dto);
    return { ok: true, app };
  }

  @Post('bulk')
  @UseGuards(JwtAuthGuard)
  async bulk(@Body() body: { apps?: UpsertApkDto[] }) {
    const items = Array.isArray(body?.apps) ? body.apps : [];
    return this.apps.upsertMany(items);
  }

  @Post('assign-random')
  @UseGuards(JwtAuthGuard)
  assignRandom() {
    return this.apps.assignRandomSections();
  }
}
