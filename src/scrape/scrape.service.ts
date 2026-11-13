import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import {
  ApkRecord,
  NotAppPageError,
  assertAndroidApksUrl,
  discoverApks,
  scrapeApkPage,
  toApkCsv,
} from './androidapks';

export type ScrapeJob = {
  id: string;
  website: string;
  status:
    | 'discovering'
    | 'running'
    | 'completed'
    | 'completed_with_errors'
    | 'cancelled'
    | 'failed'
    | 'blocked';
  total: number;
  processed: number;
  products: ApkRecord[];
  errors: { url: string; error: string }[];
  current: string;
  cancel: boolean;
  skipped: number;
  limit?: number;
  mode: 'catalog' | 'custom';
  urls?: string[];
  message?: string;
};

@Injectable()
export class ScrapeService {
  static readonly BATCH = 5;
  private readonly jobs = new Map<string, ScrapeJob>();

  /** One serverless-safe chunk: discover (first call) then scrape a few pages. */
  async batch(website: string, limit?: number, urls?: string[], modeHint?: 'catalog' | 'custom') {
    const incoming = (urls || []).map((u) => u.trim()).filter(Boolean);
    const custom = modeHint === 'custom' || incoming.length > 0;
    if (incoming.length) {
      for (const url of incoming) assertAndroidApksUrl(url);
    } else {
      assertAndroidApksUrl(website || 'https://androidapks.com/');
    }

    const capped = incoming.length ? undefined : this.parseLimit(limit);
    let queue = incoming;
    const discoverErrors: string[] = [];

    if (!queue.length) {
      const found = await discoverApks(
        website || 'https://androidapks.com/',
        undefined,
        undefined,
        capped,
      );
      queue = found.urls;
      discoverErrors.push(...found.errors);
      return {
        products: [],
        remaining: queue,
        batch: 0,
        remainingCount: queue.length,
        total: queue.length,
        skipped: 0,
        errors: discoverErrors.map((error) => ({ url: '', error })),
        done: queue.length === 0,
        mode: custom ? 'custom' : 'catalog',
        limit: capped ?? null,
      };
    }

    const take = queue.slice(0, ScrapeService.BATCH);
    const remaining = queue.slice(ScrapeService.BATCH);
    const products: ApkRecord[] = [];
    const errors: { url: string; error: string }[] = discoverErrors.map((error) => ({
      url: '',
      error,
    }));
    let skipped = 0;

    for (const url of take) {
      try {
        products.push(await scrapeApkPage(url));
      } catch (err) {
        if (err instanceof NotAppPageError) skipped += 1;
        else errors.push({ url, error: err instanceof Error ? err.message : String(err) });
      }
    }

    return {
      products,
      remaining,
      batch: take.length,
      remainingCount: remaining.length,
      total: take.length + remaining.length,
      skipped,
      errors,
      done: remaining.length === 0,
      mode: custom ? 'custom' : 'catalog',
      limit: capped ?? null,
    };
  }

  async start(website: string, limit?: number, urls?: string[]) {
    const customUrls = this.parseCustomUrls(urls);
    const mode: 'catalog' | 'custom' = customUrls.length ? 'custom' : 'catalog';
    const result = await this.batch(
      website,
      limit,
      customUrls.length ? customUrls : undefined,
      mode,
    );
    const id = randomBytes(16).toString('hex');
    const job: ScrapeJob = {
      id,
      website: (customUrls[0] || website || 'https://androidapks.com/').trim(),
      status: result.done
        ? result.errors.length
          ? 'completed_with_errors'
          : 'completed'
        : 'running',
      total: result.total,
      processed: result.batch,
      products: result.products,
      errors: result.errors,
      current: '',
      cancel: false,
      skipped: result.skipped,
      limit: result.limit ?? undefined,
      mode,
      urls: result.remaining,
    };
    this.jobs.set(id, job);
    return {
      id,
      ...result,
      status: job.status,
      success: result.products.length,
      processed: result.batch,
    };
  }

  private parseCustomUrls(urls?: string[]) {
    if (!urls?.length) return [] as string[];
    const cleaned = [
      ...new Set(
        urls
          .flatMap((line) => String(line || '').split(/[\n,]+/))
          .map((u) => u.trim())
          .filter(Boolean),
      ),
    ];
    if (!cleaned.length) return [];
    for (const url of cleaned) {
      const parsed = assertAndroidApksUrl(url);
      if (/\.(apk|apks|xapk)$/i.test(parsed.pathname) || parsed.pathname.includes('/download')) {
        throw new Error(`App details URL chahiye, download/APK file nahi: ${url}`);
      }
      // Apex homepage only — app pages often live on subdomains like
      // https://tekken-8.androidapks.com/
      const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
      const path = parsed.pathname.replace(/\/+$/, '') || '/';
      if (host === 'androidapks.com' && path === '/') {
        throw new Error(
          'Main homepage nahi — specific app URL do. Example: https://tekken-8.androidapks.com/',
        );
      }
    }
    if (cleaned.length > 500) {
      throw new Error('Custom URLs max 500 at a time.');
    }
    return cleaned;
  }

  private parseLimit(limit?: number) {
    if (limit === undefined || limit === null || Number.isNaN(Number(limit))) return undefined;
    const n = Math.floor(Number(limit));
    if (n < 1) throw new Error('Limit must be a positive whole number, or leave blank for all.');
    if (n > 50000) throw new Error('Limit too high. Use 50000 or less.');
    return n;
  }

  cancel(id: string) {
    const job = this.jobs.get(id);
    if (job) job.cancel = true;
    return { ok: true };
  }

  status(id: string) {
    const job = this.requireJob(id);
    return {
      id: job.id,
      website: job.website,
      status: job.status,
      total: job.total,
      processed: job.processed,
      current: job.current,
      cancel: job.cancel,
      skipped: job.skipped,
      limit: job.limit ?? null,
      mode: job.mode,
      success: job.products.length,
      errors: job.errors,
      message: job.message || '',
    };
  }

  products(id: string) {
    return this.requireJob(id).products;
  }

  csv(id: string) {
    return toApkCsv(this.requireJob(id).products);
  }

  private requireJob(id: string) {
    if (!/^[0-9a-f]{32}$/.test(id || '')) throw new Error('Invalid job ID');
    const job = this.jobs.get(id);
    if (!job) throw new Error('Job not found');
    return job;
  }

  private sameSite(website: string) {
    try {
      assertAndroidApksUrl(website);
      return true;
    } catch {
      return false;
    }
  }

  private async run(job: ScrapeJob) {
    try {
      let selected: string[] = [];
      if (job.mode === 'custom' && job.urls?.length) {
        selected = job.urls;
        job.status = 'running';
        job.total = selected.length;
      } else {
        const { urls, errors } = await discoverApks(
          job.website,
          (total, current) => {
            job.total = total;
            job.current = current;
          },
          () => job.cancel,
          job.limit,
        );
        job.errors.push(...errors.map((error) => ({ url: '', error })));
        if (job.cancel) {
          job.status = 'cancelled';
          return;
        }
        selected = job.limit ? urls.slice(0, job.limit) : urls;
        job.status = 'running';
        job.total = selected.length;
      }
      const seen = new Set<string>();
      let accessFailures = 0;

      for (const url of selected) {
        if (job.cancel) break;
        job.current = url;
        try {
          const product = await scrapeApkPage(url);
          accessFailures = 0;
          if (seen.has(product.url)) {
            job.skipped += 1;
          } else {
            seen.add(product.url);
            job.products.push(product);
          }
        } catch (err) {
          if (err instanceof NotAppPageError) {
            job.skipped += 1;
          } else {
            const message = err instanceof Error ? err.message : String(err);
            job.errors.push({ url, error: message });
            if (/HTTP 403|HTTP 429/.test(message)) accessFailures += 1;
            else accessFailures = 0;
            if (accessFailures >= 3) {
              job.message =
                'Website blocked 3 consecutive product requests (HTTP 403/429). Scraping stopped.';
              job.status = 'blocked';
              break;
            }
          }
        }
        job.processed += 1;
        await sleep(500);
      }

      if (job.status === 'blocked') return;
      job.status = job.cancel
        ? 'cancelled'
        : job.errors.length
          ? 'completed_with_errors'
          : 'completed';
    } catch (err) {
      job.status = 'failed';
      job.errors.push({
        url: job.website,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
