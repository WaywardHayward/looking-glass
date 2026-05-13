// Playwright walker. Captures desktop + mobile screenshots per route and
// writes a manifest.json keyed by slug+viewport.
//
// Inputs (env):
//   LG_BASE_URL       - base URL (required)
//   LG_ROUTES_JSON    - JSON array of routes (required)
//   LG_VIEWPORTS_JSON - JSON array of viewports (optional)
//   LG_OUT_DIR        - output directory (default: out)
//
// Output: <out>/shots/<slug>__<viewport>.png + <out>/manifest.json

import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parseRoutes, parseViewports } from './lib/routes.mjs';
import * as log from './lib/log.mjs';

const DEFAULT_VIEWPORTS_JSON = JSON.stringify([
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 }
]);

const SHOTS_SUBDIR = 'shots';
const MANIFEST_FILE = 'manifest.json';
const NAV_TIMEOUT_MS = 30_000;
const SETTLE_DELAY_MS = 800;

const requireEnv = (name) => {
  const value = process.env[name];
  if (!value || value.length === 0) {
    throw new Error(`missing required env var ${name}`);
  }
  return value;
};

const resolveOutDir = () => resolve(process.env.LG_OUT_DIR ?? 'out');

const buildUrl = (base, route) => {
  if (route.startsWith('http')) return route;
  const trimmedBase = base.endsWith('/') ? base.slice(0, -1) : base;
  const trimmedRoute = route.startsWith('/') ? route : `/${route}`;
  return `${trimmedBase}${trimmedRoute}`;
};

/**
 * @param {import('playwright').Browser} browser
 * @param {{name: string, width: number, height: number}} viewport
 * @param {{slug: string, url: string, label: string}} route
 * @param {string} baseUrl
 * @param {string} shotsDir
 * @returns {Promise<{slug: string, viewport: string, file: string, label: string, error?: string}>}
 */
const captureOne = async (browser, viewport, route, baseUrl, shotsDir) => {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1
  });
  const page = await context.newPage();
  const fullUrl = buildUrl(baseUrl, route.url);
  const file = join(shotsDir, `${route.slug}__${viewport.name}.png`);
  try {
    await page.goto(fullUrl, { waitUntil: 'networkidle', timeout: NAV_TIMEOUT_MS });
    await page.waitForTimeout(SETTLE_DELAY_MS);
    await page.screenshot({ path: file, fullPage: true });
    log.info(`captured ${route.slug} (${viewport.name})`);
    return { slug: route.slug, viewport: viewport.name, file, label: route.label };
  } catch (cause) {
    log.warn(`capture failed ${route.slug} (${viewport.name}): ${cause.message}`);
    return {
      slug: route.slug,
      viewport: viewport.name,
      file,
      label: route.label,
      error: cause.message
    };
  } finally {
    await context.close().catch(() => {});
  }
};

const loadPlaywright = async () => {
  try {
    return await import('playwright');
  } catch (cause) {
    throw new Error(
      `playwright is not installed. Add "npx playwright install --with-deps chromium" to your workflow. (${cause.message})`
    );
  }
};

const run = async () => {
  const baseUrl = requireEnv('LG_BASE_URL');
  const routes = parseRoutes(requireEnv('LG_ROUTES_JSON'));
  const viewports = parseViewports(process.env.LG_VIEWPORTS_JSON || DEFAULT_VIEWPORTS_JSON);
  const outDir = resolveOutDir();
  const shotsDir = join(outDir, SHOTS_SUBDIR);
  await mkdir(shotsDir, { recursive: true });

  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch({ headless: true });
  const entries = [];
  try {
    for (const route of routes) {
      for (const viewport of viewports) {
        // eslint-disable-next-line no-await-in-loop
        entries.push(await captureOne(browser, viewport, route, baseUrl, shotsDir));
      }
    }
  } finally {
    await browser.close().catch(() => {});
  }

  const manifest = {
    baseUrl,
    routes,
    viewports,
    entries,
    capturedAt: new Date().toISOString(),
    partial: entries.some((e) => e.error)
  };
  const manifestPath = join(outDir, MANIFEST_FILE);
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  log.info(`manifest written ${manifestPath}`);
  process.stdout.write(`${manifestPath}\n`);
};

run().catch((err) => {
  log.error(err.stack || err.message);
  process.exit(1);
});
