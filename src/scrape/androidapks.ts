import * as cheerio from 'cheerio';
import { XMLParser } from 'fast-xml-parser';

export type ApkRecord = {
  app_name: string;
  version: string;
  package_name: string;
  developer: string;
  category: string;
  file_size: string;
  updated: string;
  minimum_android: string;
  architecture: string;
  screen_dpi: string;
  md5: string;
  sha1: string;
  rating: string;
  rating_count: string;
  downloads: string;
  price: string;
  currency: string;
  url: string;
  download_page_links: string[];
  icon: string;
  screenshots: string[];
  description: string;
  description_html: string;
  release_notes: string;
  scraped_at: string;
  google_play_url: string;
  languages: string;
  file_name: string;
};

export class NotAppPageError extends Error {
  constructor(message = 'Not an app details page') {
    super(message);
    this.name = 'NotAppPageError';
  }
}

export const APK_COLUMNS: (keyof ApkRecord)[] = [
  'app_name',
  'version',
  'package_name',
  'developer',
  'category',
  'file_size',
  'updated',
  'minimum_android',
  'architecture',
  'screen_dpi',
  'md5',
  'sha1',
  'rating',
  'rating_count',
  'downloads',
  'price',
  'currency',
  'url',
  'download_page_links',
  'icon',
  'screenshots',
  'description',
  'description_html',
  'release_notes',
  'scraped_at',
  'google_play_url',
  'languages',
  'file_name',
];

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export function assertAndroidApksUrl(raw: string) {
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    throw new Error('Enter a valid https://androidapks.com URL.');
  }
  const host = (parsed.hostname || '').replace(/^www\./, '');
  const ok = host === 'androidapks.com' || host.endsWith('.androidapks.com');
  if (!/^https?:$/.test(parsed.protocol) || !ok || parsed.username || parsed.password) {
    throw new Error('This field only accepts androidapks.com URLs.');
  }
  return parsed;
}

function abs(base: string, href: string) {
  try {
    return new URL(href, base).toString();
  } catch {
    return '';
  }
}

async function fetchText(url: string, redirects = 0): Promise<string> {
  assertAndroidApksUrl(url);
  if (redirects > 5) throw new Error('Too many redirects');
  const res = await fetch(url, {
    redirect: 'manual',
    headers: { 'User-Agent': UA },
    signal: AbortSignal.timeout(40000),
  });
  if (res.status >= 300 && res.status < 400) {
    const loc = res.headers.get('location');
    if (!loc) throw new Error(`Redirect without location: ${url}`);
    return fetchText(abs(url, loc), redirects + 1);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

function walk(value: unknown): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  if (Array.isArray(value)) {
    for (const child of value) out.push(...walk(child));
  } else if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    out.push(obj);
    for (const child of Object.values(obj)) out.push(...walk(child));
  }
  return out;
}

function collectLocs(node: unknown, out: string[] = []): string[] {
  if (!node || typeof node !== 'object') return out;
  if (Array.isArray(node)) {
    for (const item of node) collectLocs(item, out);
    return out;
  }
  const obj = node as Record<string, unknown>;
  if (typeof obj.loc === 'string') out.push(obj.loc.trim());
  else if (obj.loc && typeof obj.loc === 'object' && '#text' in (obj.loc as object)) {
    const text = String((obj.loc as { '#text'?: string })['#text'] || '').trim();
    if (text) out.push(text);
  }
  for (const value of Object.values(obj)) collectLocs(value, out);
  return out;
}

export async function discoverApks(
  website: string,
  onProgress?: (total: number, current: string) => void,
  cancelled?: () => boolean,
  limit?: number,
): Promise<{ urls: string[]; errors: string[] }> {
  assertAndroidApksUrl(website);
  const queue = ['https://androidapks.com/sitemap.xml'];
  const seen = new Set<string>();
  const apps = new Set<string>();
  const errors: string[] = [];
  const parser = new XMLParser({
    ignoreAttributes: false,
    removeNSPrefix: true,
  });
  const enough = () => typeof limit === 'number' && apps.size >= limit;

  while (queue.length && !(cancelled && cancelled()) && !enough()) {
    const url = queue.shift()!;
    if (seen.has(url)) continue;
    seen.add(url);
    try {
      const xml = await fetchText(url);
      const doc = parser.parse(xml);
      const isIndex = Boolean(doc?.sitemapindex);
      const locs = collectLocs(doc);
      for (const loc of locs) {
        if (enough()) break;
        try {
          assertAndroidApksUrl(loc);
        } catch {
          continue;
        }
        const path = new URL(loc).pathname;
        if (isIndex) {
          if (/\/apk-sitemap\d*\.xml$/i.test(path)) queue.push(loc);
          continue;
        }
        if (
          path.includes('/download') ||
          path.includes('/wp-') ||
          path.includes('/cdn-cgi') ||
          /\.(apk|apks|xapk)$/i.test(path)
        ) {
          continue;
        }
        const clean = new URL(loc);
        clean.search = '';
        clean.hash = '';
        apps.add(clean.toString());
      }
    } catch (err) {
      errors.push(`${url}: ${err instanceof Error ? err.message : String(err)}`);
    }
    onProgress?.(apps.size, url);
  }

  if (!apps.size && !(cancelled && cancelled())) {
    throw new Error(`No APK listing URLs found. ${errors.slice(0, 3).join(' ')}`);
  }
  const urls = [...apps].sort();
  return { urls: limit ? urls.slice(0, limit) : urls, errors };
}

export async function scrapeApkPage(url: string): Promise<ApkRecord> {
  const parsed = assertAndroidApksUrl(url);
  if (/\.(apk|apks|xapk)$/i.test(parsed.pathname) || parsed.pathname.includes('/download')) {
    throw new Error('Enter an app details page, not an APK file or download endpoint.');
  }
  const html = await fetchText(url);
  return parseApkHtml(html, url);
}

export function parseApkHtml(html: string, url: string): ApkRecord {
  const $ = cheerio.load(html);
  const schemas: Record<string, unknown>[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      schemas.push(...walk(JSON.parse($(el).text())));
    } catch {
      /* ignore bad json-ld */
    }
  });
  const app =
    schemas.find((s) => {
      const type = s['@type'];
      return type === 'MobileApplication' || type === 'SoftwareApplication';
    }) || ({} as Record<string, unknown>);

  const specs: Record<string, string> = {};
  $('.apk_file_div tr').each((_, row) => {
    const cells = $(row).find('th,td');
    if (cells.length > 1) {
      const key = $(cells[0]).text().replace(/\s+/g, ' ').trim().replace(/:$/, '');
      const value = $(cells[1]).text().replace(/\s+/g, ' ').trim();
      if (key) specs[key] = value;
    }
  });

  const title =
    String(app.name || '') ||
    ($('h1').first().text().replace(/\s+/g, ' ').trim() || '') ||
    ($('meta[property="og:title"]').attr('content') || '').replace(/\s+/g, ' ').trim();
  const looksLikeApp =
    Boolean(title) &&
    (Boolean(app.name) ||
      $('.apk_file_div').length > 0 ||
      /apk/i.test(title) ||
      $('a[href*="/download"]').length > 0);
  if (!looksLikeApp) throw new NotAppPageError();
  if (!title) throw new Error('App name missing');

  let icon = app.image as string | Record<string, unknown> | undefined;
  if (icon && typeof icon === 'object') icon = String(icon.url || '');
  const iconUrl = icon ? abs(url, String(icon)) : '';

  let shots = app.screenshot as unknown;
  if (typeof shots === 'string' || (shots && typeof shots === 'object' && !Array.isArray(shots))) {
    shots = [shots];
  }
  const screenshots = Array.isArray(shots)
    ? [
        ...new Set(
          shots
            .map((item) => {
              if (!item) return '';
              if (typeof item === 'string') return abs(url, item);
              if (typeof item === 'object' && item && 'url' in item) {
                return abs(url, String((item as { url?: string }).url || ''));
              }
              return '';
            })
            .filter(Boolean),
        ),
      ]
    : [];

  const descriptionEl = $('#app-description-latest, .app-description-latest').first();
  let offers = app.offers as Record<string, unknown> | Record<string, unknown>[] | undefined;
  if (Array.isArray(offers)) offers = offers[0];
  const rating = (app.aggregateRating as Record<string, unknown>) || {};
  let developer = (app.author || app.publisher) as string | Record<string, unknown> | undefined;
  if (developer && typeof developer === 'object') developer = String(developer.name || '');

  const links: string[] = [];
  $('a[href]').each((_, a) => {
    const link = abs(url, $(a).attr('href') || '');
    if (!link) return;
    try {
      const p = new URL(link);
      assertAndroidApksUrl(link);
      if (!p.pathname.includes('/download/')) return;
      if (/\.(apk|apks|xapk)$/i.test(p.pathname)) return;
      links.push(link);
    } catch {
      /* skip */
    }
  });

  const interaction = (app.interactionStatistic as Record<string, unknown>) || {};

  return {
    app_name: title,
    version: specs.Version || String(app.softwareVersion || ''),
    package_name: specs['Package name'] || '',
    developer: String(developer || ''),
    category: String(app.applicationCategory || ''),
    file_size: specs['File size'] || String(app.fileSize || ''),
    updated: specs.Updated || '',
    minimum_android: specs['Minimum Android version'] || String(app.operatingSystem || ''),
    architecture: specs.Architecture || '',
    screen_dpi: specs['Screen DPI'] || '',
    md5: specs.MD5 || '',
    sha1: specs.SHA1 || '',
    rating: String(rating.ratingValue || ''),
    rating_count: String(rating.ratingCount || rating.reviewCount || ''),
    downloads: String(interaction.userInteractionCount || ''),
    price: String((offers as Record<string, unknown> | undefined)?.price || ''),
    currency: String((offers as Record<string, unknown> | undefined)?.priceCurrency || ''),
    url,
    download_page_links: [...new Set(links)],
    icon: iconUrl,
    screenshots,
    description: descriptionEl.length
      ? descriptionEl.text().replace(/\n+/g, '\n').trim()
      : String(app.description || ''),
    description_html: descriptionEl.length ? descriptionEl.html() || '' : '',
    release_notes: String(app.releaseNotes || ''),
    scraped_at: new Date().toISOString(),
    google_play_url: '',
    languages: '',
    file_name: '',
  };
}

function csvEscape(value: unknown) {
  let text =
    typeof value === 'object' && value !== null
      ? JSON.stringify(value)
      : String(value ?? '');
  if (text.startsWith('=') || text.startsWith('+') || text.startsWith('-') || text.startsWith('@')) {
    text = `'${text}`;
  }
  if (/[",\n\r]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

function slugFromUrl(url: string, name: string) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    const sub = host.replace(/\.androidapks\.com$/i, '');
    if (sub && sub !== 'androidapks.com' && sub !== host) {
      return sub.replace(/[^a-z0-9-]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
    }
    const path = new URL(url).pathname.replace(/\/+$/, '').split('/').filter(Boolean).pop() || '';
    if (path) return path.toLowerCase();
  } catch {
    /* ignore */
  }
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

/** CSV the Upload CSV tool can import without extra mapping. */
export function toImportCsv(apps: ApkRecord[]): string {
  const headers = [
    'name',
    'packageName',
    'version',
    'developer',
    'kind',
    'category',
    'size',
    'apkUrl',
    'iconUrl',
    'short',
    'description',
    'requires',
    'slug',
  ];
  const lines = [headers.join(',')];
  for (const app of apps) {
    const slug = slugFromUrl(app.url, app.app_name);
    const apkUrl = app.download_page_links?.[0] || app.url;
    const kind = /game/i.test(app.category) ? 'game' : 'app';
    const pkg =
      app.package_name.trim() || `com.apk.${slug.replace(/-/g, '') || 'app'}`;
    const description = (app.description || '').slice(0, 20000);
    lines.push(
      [
        app.app_name,
        pkg,
        app.version || '1.0.0',
        app.developer || 'Unknown',
        kind,
        app.category || 'tools',
        app.file_size || '—',
        apkUrl,
        app.icon,
        description.slice(0, 160),
        description,
        app.minimum_android || 'Android 8.0+',
        slug || pkg,
      ].map(csvEscape).join(','),
    );
  }
  return `\uFEFF${lines.join('\n')}`;
}

export function toApkCsv(apps: ApkRecord[]): string {
  return toImportCsv(apps);
}
