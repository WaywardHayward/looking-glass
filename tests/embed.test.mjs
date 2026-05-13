import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import {
  thumbnailToDataUri,
  buildEmbedMap,
  artefactDownloadLine,
  artefactDownloadUrl,
  MAX_COMMENT_CHARS,
  THUMB_WIDTH
} from '../src/lib/embed.mjs';
import { renderArtefact, OVERFLOW_FALLBACK_LINE } from '../src/lib/markdown.mjs';

const makePng = async (path, width = 800, height = 600) => {
  const buf = await sharp({
    create: { width, height, channels: 3, background: { r: 200, g: 100, b: 50 } }
  }).png().toBuffer();
  await writeFile(path, buf);
};

const setupFixture = async () => {
  const dir = await mkdtemp(join(tmpdir(), 'lg-embed-'));
  const shots = join(dir, 'shots');
  await mkdir(shots, { recursive: true });
  const desktopPath = join(shots, 'home__desktop.png');
  const mobilePath = join(shots, 'home__mobile.png');
  await makePng(desktopPath);
  await makePng(mobilePath, 390, 844);
  return { dir, desktopPath, mobilePath };
};

test('Value: thumbnailToDataUri produces a jpeg data URI for a valid png', async () => {
  const { desktopPath } = await setupFixture();
  const uri = await thumbnailToDataUri(desktopPath);
  assert.ok(uri.startsWith('data:image/jpeg;base64,'));
  assert.ok(uri.length > 100);
});

test('Edge: thumbnailToDataUri returns null for missing files', async () => {
  const uri = await thumbnailToDataUri('/no/such/file.png');
  assert.equal(uri, null);
});

test('Value: buildEmbedMap skips entries with errors and missing files', async () => {
  const { desktopPath } = await setupFixture();
  const entries = [
    { file: desktopPath, viewport: 'desktop' },
    { file: '/missing.png', viewport: 'mobile' },
    { error: 'timeout', viewport: 'desktop' }
  ];
  const map = await buildEmbedMap(entries);
  assert.equal(map.size, 1);
  assert.ok(map.get(desktopPath).startsWith('data:image/jpeg;base64,'));
});

test('Value: artefactDownloadUrl appends #artifacts to the run URL', () => {
  const href = artefactDownloadUrl('https://github.com/o/r/actions/runs/123');
  assert.equal(href, 'https://github.com/o/r/actions/runs/123#artifacts');
  assert.equal(artefactDownloadUrl(''), null);
});

test('Value: artefactDownloadLine renders a markdown link', () => {
  const line = artefactDownloadLine('https://github.com/o/r/actions/runs/9');
  assert.match(line, /\ud83d\udce6 \[Download full screenshots\]\(https:\/\/github\.com\/o\/r\/actions\/runs\/9#artifacts\)/);
});

test('Interaction: renderArtefact embeds data URIs when embedMap is provided', async () => {
  const { dir, desktopPath, mobilePath } = await setupFixture();
  const manifest = {
    baseUrl: 'https://example.com',
    routes: [{ slug: 'home', url: '/', label: 'Home' }],
    entries: [
      { slug: 'home', viewport: 'desktop', file: desktopPath, label: 'Home' },
      { slug: 'home', viewport: 'mobile', file: mobilePath, label: 'Home' }
    ],
    partial: false
  };
  const embedMap = await buildEmbedMap(manifest.entries);
  const { body } = renderArtefact({
    manifest,
    captionsData: null,
    critiquesData: null,
    prTitle: 'test',
    prNumber: '1',
    outDir: dir,
    generatedAt: 't',
    embedMap,
    artefactLink: '\ud83d\udce6 [Download full screenshots](https://example.com/run/1#artifacts)'
  });
  assert.match(body, /data:image\/jpeg;base64,/);
  assert.match(body, /Download full screenshots/);
});

test('Edge: renderArtefact falls back when budget would overflow', async () => {
  const { dir, desktopPath, mobilePath } = await setupFixture();
  const manifest = {
    baseUrl: 'https://example.com',
    routes: [
      { slug: 'home', url: '/', label: 'Home' },
      { slug: 'pricing', url: '/pricing', label: 'Pricing' }
    ],
    entries: [
      { slug: 'home', viewport: 'desktop', file: desktopPath, label: 'Home' },
      { slug: 'home', viewport: 'mobile', file: mobilePath, label: 'Home' },
      { slug: 'pricing', viewport: 'desktop', file: desktopPath, label: 'Pricing' },
      { slug: 'pricing', viewport: 'mobile', file: mobilePath, label: 'Pricing' }
    ],
    partial: false
  };
  const embedMap = await buildEmbedMap(manifest.entries);
  const { body } = renderArtefact({
    manifest,
    captionsData: null,
    critiquesData: null,
    prTitle: 'test',
    prNumber: '1',
    outDir: dir,
    generatedAt: 't',
    embedMap,
    artefactLink: '\ud83d\udce6 [Download full screenshots](https://example.com/run/1#artifacts)',
    maxChars: 2800
  });
  assert.ok(body.length < 6000, `body grew to ${body.length} chars under tiny budget`);
  assert.match(body, new RegExp(OVERFLOW_FALLBACK_LINE.replace(/[\[\]()]/g, '.')));
  // The body must contain at least one embedded data URI (first section fits).
  assert.match(body, /data:image\/jpeg;base64,/);
  // No truncated base64 mid-string: every data URI line ends cleanly.
  const lines = body.split('\n');
  for (const line of lines) {
    if (line.includes('data:image/jpeg;base64,')) {
      assert.match(line, /\)/, `data URI line missing closing paren: ${line.slice(0, 80)}`);
    }
  }
});

test('Value: MAX_COMMENT_CHARS sits safely below GitHub 65536 limit', () => {
  assert.ok(MAX_COMMENT_CHARS <= 60000);
  assert.equal(THUMB_WIDTH, 200);
});
