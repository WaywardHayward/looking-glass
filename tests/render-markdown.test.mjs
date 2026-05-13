import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { renderArtefact, summariseVerdicts, overallStatus, groupBySlug, COMMENT_MARKER } from '../src/lib/markdown.mjs';

const baseManifest = {
  baseUrl: 'https://example.com',
  routes: [
    { slug: 'home', url: '/', label: 'Home' },
    { slug: 'pricing', url: '/pricing', label: 'Pricing' }
  ],
  entries: [
    { slug: 'home', viewport: 'desktop', file: '/abs/out/shots/home__desktop.png', label: 'Home' },
    { slug: 'home', viewport: 'mobile', file: '/abs/out/shots/home__mobile.png', label: 'Home' },
    { slug: 'pricing', viewport: 'desktop', file: '/abs/out/shots/pricing__desktop.png', label: 'Pricing' },
    { slug: 'pricing', viewport: 'mobile', file: '/abs/out/shots/pricing__mobile.png', label: 'Pricing' }
  ],
  partial: false
};

test('Value: renderArtefact embeds the comment marker', () => {
  const { body } = renderArtefact({
    manifest: baseManifest,
    captionsData: null,
    critiquesData: null,
    prTitle: 'feat: x',
    prNumber: '42',
    outDir: '/abs/out',
    generatedAt: '2026-01-01T00:00:00Z'
  });
  assert.ok(body.startsWith(COMMENT_MARKER));
  assert.match(body, /feat: x/);
  assert.match(body, /#42/);
});

test('Value: critiques drive the verdict line', () => {
  const critiquesData = {
    critiques: {
      home: { verdict: '🟢', summary: 'Looking sharp', observations: ['Nice header', 'Good CTA'] },
      pricing: { verdict: '🟡', summary: 'Needs work', observations: ['Spacing off'] }
    }
  };
  const { body, summary } = renderArtefact({
    manifest: baseManifest,
    captionsData: null,
    critiquesData,
    prTitle: '',
    prNumber: '',
    outDir: '/abs/out',
    generatedAt: 't'
  });
  assert.match(body, /🟢 Looking sharp/);
  assert.match(body, /🟡 Needs work/);
  assert.match(body, /1\. Nice header/);
  assert.match(summary, /2 pages/);
  assert.match(summary, /1🟢/);
  assert.match(summary, /1🟡/);
});

test('Interaction: captions render per viewport', () => {
  const captionsData = {
    captions: {
      home__desktop: { caption: 'Big bold home page' },
      home__mobile: { caption: 'Stacked single column' }
    }
  };
  const { body } = renderArtefact({
    manifest: baseManifest, captionsData, critiquesData: null,
    prTitle: '', prNumber: '', outDir: '/abs/out', generatedAt: 't'
  });
  assert.match(body, /Big bold home page/);
  assert.match(body, /Stacked single column/);
});

test('Edge: partial manifest yields partial status', () => {
  const partial = { ...baseManifest, partial: true };
  const { status } = renderArtefact({
    manifest: partial, captionsData: null, critiquesData: null,
    prTitle: '', prNumber: '', outDir: '/abs/out', generatedAt: 't'
  });
  assert.equal(status, 'partial');
});

test('Edge: capture error renders inline warning', () => {
  const manifest = {
    ...baseManifest,
    entries: [
      { slug: 'home', viewport: 'desktop', file: '/abs/out/shots/home__desktop.png', label: 'Home', error: 'timeout' },
      { slug: 'home', viewport: 'mobile', file: '/abs/out/shots/home__mobile.png', label: 'Home' }
    ],
    routes: [{ slug: 'home', url: '/', label: 'Home' }],
    partial: true
  };
  const { body, status } = renderArtefact({
    manifest, captionsData: null, critiquesData: null,
    prTitle: '', prNumber: '', outDir: '/abs/out', generatedAt: 't'
  });
  assert.match(body, /capture failed: timeout/);
  assert.equal(status, 'partial');
});

test('Edge: critique error degrades gracefully', () => {
  const critiquesData = { critiques: { home: { error: 'rate limited' } } };
  const { body, status } = renderArtefact({
    manifest: baseManifest, captionsData: null, critiquesData,
    prTitle: '', prNumber: '', outDir: '/abs/out', generatedAt: 't'
  });
  assert.match(body, /critique error: rate limited/);
  assert.equal(status, 'partial');
});

test('Value: summariseVerdicts handles empty input', () => {
  assert.equal(summariseVerdicts(undefined), '0 pages: 0🟢 0🟡 0🔴');
  assert.equal(summariseVerdicts({}), '0 pages: 0🟢 0🟡 0🔴');
});

test('Value: overallStatus returns ok when clean', () => {
  assert.equal(overallStatus({ partial: false }, null, null), 'ok');
});

test('Interaction: groupBySlug clusters entries', () => {
  const groups = groupBySlug(baseManifest.entries);
  assert.equal(groups.size, 2);
  assert.equal(groups.get('home').length, 2);
});
