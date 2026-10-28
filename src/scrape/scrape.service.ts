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
  message?: string;
};

@Injectable()
export class ScrapeService {
  private readonly jobs = new Map<string, ScrapeJob>();

  start(website: string) {
    assertAndroidApksUrl(website);
    for (const job of this.jobs.values()) {
      if (
        (job.status === 'discovering' || job.status === 'running') &&
        this.sameSite(job.website)
      ) {
        return { id: job.id };
      }
    }
    const id = randomBytes(16).toString('hex');
    const job: ScrapeJob = {
      id,
      website: website.trim(),
      status: 'discovering',
      total: 0,
      processed: 0,
      products: [],
      errors: [],
      current: '',
      cancel: false,
      skipped: 0,
    };
    this.jobs.set(id, job);
    void this.run(job);
    return { id };
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
      const { urls, errors } = await discoverApks(
        job.website,
        (total, current) => {
          job.total = total;
          job.current = current;
        },
        () => job.cancel,
      );
      job.errors.push(...errors.map((error) => ({ url: '', error })));
      if (job.cancel) {
        job.status = 'cancelled';
        return;
      }
      job.status = 'running';
      job.total = urls.length;
      const seen = new Set<string>();
      let accessFailures = 0;

      for (const url of urls) {
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
