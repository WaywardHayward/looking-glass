import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { parseRoutes, parseViewports } from '../src/lib/routes.mjs';

test('Value: parseRoutes accepts a valid JSON array', () => {
  const raw = JSON.stringify([
    { slug: 'home', url: '/', label: 'Home' },
    { slug: 'pricing-v2', url: '/pricing', label: 'Pricing' }
  ]);
  const routes = parseRoutes(raw);
  assert.equal(routes.length, 2);
  assert.equal(routes[0].slug, 'home');
  assert.equal(routes[1].label, 'Pricing');
});

test('Edge: empty input rejected', () => {
  assert.throws(() => parseRoutes(''), /empty/);
});

test('Edge: malformed JSON rejected', () => {
  assert.throws(() => parseRoutes('{not json'), /not valid JSON/);
});

test('Edge: non-array rejected', () => {
  assert.throws(() => parseRoutes('{"slug":"home"}'), /must be a JSON array/);
});

test('Edge: empty array rejected', () => {
  assert.throws(() => parseRoutes('[]'), /at least one route/);
});

test('Edge: missing slug rejected', () => {
  const raw = JSON.stringify([{ url: '/', label: 'Home' }]);
  assert.throws(() => parseRoutes(raw), /missing required string field "slug"/);
});

test('Edge: invalid slug shape rejected', () => {
  const raw = JSON.stringify([{ slug: 'Bad Slug!', url: '/', label: 'x' }]);
  assert.throws(() => parseRoutes(raw), /must match/);
});

test('Edge: invalid url rejected', () => {
  const raw = JSON.stringify([{ slug: 'a', url: 'pricing', label: 'x' }]);
  assert.throws(() => parseRoutes(raw), /must start with/);
});

test('Interaction: full http url accepted', () => {
  const raw = JSON.stringify([{ slug: 'ext', url: 'https://example.com', label: 'External' }]);
  const routes = parseRoutes(raw);
  assert.equal(routes[0].url, 'https://example.com');
});

test('Value: parseViewports accepts valid JSON', () => {
  const raw = JSON.stringify([{ name: 'desktop', width: 1440, height: 900 }]);
  const vps = parseViewports(raw);
  assert.equal(vps.length, 1);
  assert.equal(vps[0].name, 'desktop');
  assert.equal(vps[0].width, 1440);
});

test('Edge: viewport with non-positive width rejected', () => {
  const raw = JSON.stringify([{ name: 'desktop', width: 0, height: 900 }]);
  assert.throws(() => parseViewports(raw), /width must be a positive number/);
});

test('Edge: viewport missing name rejected', () => {
  const raw = JSON.stringify([{ width: 1440, height: 900 }]);
  assert.throws(() => parseViewports(raw), /name must be a non-empty string/);
});
