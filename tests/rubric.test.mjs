import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadRubric, rubricForSlug, defaultRubric } from '../src/lib/rubric.mjs';

const makeTempFile = async (name, contents) => {
  const dir = await mkdtemp(join(tmpdir(), 'lg-'));
  const path = join(dir, name);
  await writeFile(path, contents);
  return { dir, path };
};

test('Value: defaultRubric exposes all sections', () => {
  const r = defaultRubric();
  assert.ok(r.brand);
  assert.ok(r.visual);
  assert.deepEqual(r.primaryActions, {});
  assert.deepEqual(r.journeys, []);
  assert.equal(r.source, 'default');
});

test('Value: loadRubric returns defaults for missing file', async () => {
  const r = await loadRubric('/nope/does-not-exist.yml');
  assert.equal(r.source, 'default');
  assert.ok(typeof r.brand.voice === 'string');
});

test('Interaction: loadRubric parses a valid rubric', async () => {
  const { dir, path } = await makeTempFile('r.yml', [
    'brand:',
    '  voice: "sharp"',
    'primaryActions:',
    '  home: "Click me"',
    'journeys:',
    '  - name: "core"',
    '    includes: [home]',
    ''
  ].join('\n'));
  try {
    const r = await loadRubric(path);
    assert.equal(r.brand.voice, 'sharp');
    assert.equal(r.primaryActions.home, 'Click me');
    assert.equal(r.journeys.length, 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('Edge: malformed yaml throws', async () => {
  const { dir, path } = await makeTempFile('r.yml', 'brand:\n  voice: [unterminated');
  try {
    await assert.rejects(() => loadRubric(path), /rubric YAML is invalid/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('Edge: non-object root throws', async () => {
  const { dir, path } = await makeTempFile('r.yml', '- just-a-list\n');
  try {
    await assert.rejects(() => loadRubric(path), /rubric root must be an object/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('Value: rubricForSlug returns a filtered slice', () => {
  const r = {
    ...defaultRubric(),
    primaryActions: { home: 'Go' },
    journeys: [
      { name: 'a', includes: ['home'] },
      { name: 'b', includes: ['other'] }
    ]
  };
  const slice = rubricForSlug(r, 'home');
  assert.equal(slice.primaryAction, 'Go');
  assert.equal(slice.journeys.length, 1);
  assert.equal(slice.journeys[0].name, 'a');
});

test('Edge: empty yaml file falls back to defaults', async () => {
  const { dir, path } = await makeTempFile('r.yml', '');
  try {
    const r = await loadRubric(path);
    assert.equal(r.source, 'default');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
