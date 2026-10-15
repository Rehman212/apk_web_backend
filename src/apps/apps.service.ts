import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PatchApkDto, UpsertApkDto } from './dto/apk.dto';
import { HOME_SECTIONS, isHomeSection } from './home-sections';

@Injectable()
export class AppsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.apk.findMany({ orderBy: { updatedAt: 'desc' } });
  }

  count() {
    return this.prisma.apk.count();
  }

  sectionsMeta() {
    return HOME_SECTIONS;
  }

  async sectionCounts() {
    const groups = await this.prisma.apk.groupBy({
      by: ['homeSection'],
      _count: { _all: true },
    });
    const map = Object.fromEntries(groups.map((g) => [g.homeSection, g._count._all]));
    return HOME_SECTIONS.map((s) => ({
      ...s,
      count: map[s.slug] ?? 0,
    }));
  }

  async homeFeed(limit = 6) {
    const result: Record<string, unknown[]> = {};
    for (const section of HOME_SECTIONS) {
      result[section.slug] = await this.prisma.apk.findMany({
        where: { homeSection: section.slug },
        orderBy: { updatedAt: 'desc' },
        take: limit,
      });
    }
    return { sections: HOME_SECTIONS, apps: result };
  }

  async upsert(dto: UpsertApkDto) {
    const homeSection =
      dto.homeSection && isHomeSection(dto.homeSection)
        ? dto.homeSection
        : 'latest-updates';

    const data = {
      slug: dto.slug.trim(),
      name: dto.name.trim(),
      packageName: dto.packageName.trim(),
      developer: dto.developer?.trim() || 'Unknown',
      kind: dto.kind?.trim() || 'app',
      category: dto.category?.trim() || 'tools',
      homeSection,
      version: dto.version?.trim() || '1.0.0',
      size: dto.size?.trim() || '—',
      apkUrl: dto.apkUrl?.trim() || null,
      iconUrl: dto.iconUrl?.trim() || null,
      short: dto.short?.trim() || '',
      description: dto.description?.trim() || '',
      requires: dto.requires?.trim() || 'Android 8.0+',
      accent: dto.accent?.trim() || '#2f7bff',
      letter: (dto.letter || dto.name).slice(0, 2).toUpperCase(),
      payload: (dto.payload ?? undefined) as Prisma.InputJsonValue | undefined,
    };

    return this.prisma.apk.upsert({
      where: { packageName: data.packageName },
      create: data,
      update: {
        slug: data.slug,
        name: data.name,
        developer: data.developer,
        kind: data.kind,
        category: data.category,
        homeSection: data.homeSection,
        version: data.version,
        size: data.size,
        apkUrl: data.apkUrl,
        iconUrl: data.iconUrl,
        short: data.short,
        description: data.description,
        requires: data.requires,
        accent: data.accent,
        letter: data.letter,
        payload: data.payload,
      },
    });
  }

  async patch(id: string, dto: PatchApkDto) {
    const existing = await this.prisma.apk.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('APK not found');

    const homeSection =
      dto.homeSection && isHomeSection(dto.homeSection)
        ? dto.homeSection
        : undefined;

    return this.prisma.apk.update({
      where: { id },
      data: {
        ...(homeSection ? { homeSection } : {}),
        ...(dto.name ? { name: dto.name.trim() } : {}),
        ...(dto.category ? { category: dto.category.trim() } : {}),
        ...(dto.kind ? { kind: dto.kind.trim() } : {}),
      },
    });
  }

  async upsertMany(items: UpsertApkDto[]) {
    let saved = 0;
    for (const item of items) {
      await this.upsert(item);
      saved += 1;
    }
    return { saved, count: await this.count() };
  }

  async assignRandomSections() {
    const apps = await this.prisma.apk.findMany({ select: { id: true } });
    let i = 0;
    for (const app of apps) {
      const section = HOME_SECTIONS[i % HOME_SECTIONS.length].slug;
      await this.prisma.apk.update({
        where: { id: app.id },
        data: { homeSection: section },
      });
      i += 1;
    }
    return { updated: apps.length, sections: await this.sectionCounts() };
  }
}
