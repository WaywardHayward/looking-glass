// Per-route critique. Pairs desktop + mobile shots of the same slug and asks
// the model for a rubric-aware verdict plus 1-5 numbered observations.

import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { selectTransport } from './transport/select.mjs';
import { loadImageForTransport } from './lib/image.mjs';
import { loadRubric, rubricForSlug } from './lib/rubric.mjs';
import * as log from './lib/log.mjs';

const VERDICTS = Object.freeze(['🟢', '🟡', '🔴']);
const MIN_OBS = 1;
const MAX_OBS = 5;
const MAX_RETRIES = 1;

const SYSTEM_PROMPT = [
  'You are a senior product designer reviewing a deployed page on a pull request.',
  'You will see desktop and mobile screenshots of the same page.',
  'Judge against the supplied rubric (brand voice, visual rules, primary action, journeys).',
  'Be specific, honest, kind. No em dashes. No filler. No marketing language.',
  'Respond as strict JSON with this exact shape:',
  '{ "verdict": "🟢" | "🟡" | "🔴", "summary": "one-line verdict reason", "observations": ["1...", "2...", "3..."] }',
  'Use 🟢 if the page is in good shape, 🟡 if it needs polish, 🔴 if something is broken or off-brand.',
  `Give between ${MIN_OBS} and ${MAX_OBS} observations, ordered by importance.`
].join(' ');

const buildUserText = (slug, label, prTitle, slice) =>
  [
    `PR title: ${prTitle || '(none)'}`,
    `Slug: ${slug}`,
    `Label: ${label}`,
    'Rubric (JSON):',
    JSON.stringify(slice, null, 2),
    'Review the screenshots and return the JSON now.'
  ].join('\n');

const groupBySlug = (entries) => {
  const groups = new Map();
  for (const entry of entries) {
    const list = groups.get(entry.slug) ?? [];
    list.push(entry);
    groups.set(entry.slug, list);
  }
  return groups;
};

const buildImagePayload = async (group, transportId) => {
  const images = [];
  const imageRefs = [];
  for (const entry of group) {
    if (entry.error) continue;
    // eslint-disable-next-line no-await-in-loop
    const loaded = await loadImageForTransport(entry.file, transportId);
    images.push(...loaded.images);
    imageRefs.push(...loaded.imageRefs);
  }
  return { images, imageRefs };
};

const validateResult = (json) => {
  if (!json || typeof json !== 'object') throw new Error('not an object');
  if (!VERDICTS.includes(json.verdict)) {
    throw new Error(`verdict must be one of ${VERDICTS.join(',')}, got ${json.verdict}`);
  }
  if (typeof json.summary !== 'string' || json.summary.length === 0) {
    throw new Error('summary missing');
  }
  if (!Array.isArray(json.observations) || json.observations.length < MIN_OBS) {
    throw new Error('observations must be a non-empty array');
  }
  const trimmed = json.observations.slice(0, MAX_OBS).map((o) => String(o));
  return { verdict: json.verdict, summary: json.summary.trim(), observations: trimmed };
};

/**
 * @returns {Promise<{verdict?: string, summary?: string, observations?: string[], error?: string}>}
 */
const critiqueOne = async (transport, slug, group, rubric, prTitle, model) => {
  const liveShots = group.filter((g) => !g.error);
  if (liveShots.length === 0) {
    return { error: 'all captures failed for this slug' };
  }
  const label = group[0].label;
  const slice = rubricForSlug(rubric, slug);
  const { images, imageRefs } = await buildImagePayload(group, transport.id);
  const payload = {
    model,
    systemPrompt: SYSTEM_PROMPT,
    userText: buildUserText(slug, label, prTitle, slice),
    images,
    imageRefs,
    jsonMode: true
  };
  let lastError;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const { json } = await transport.run(payload);
      return validateResult(json);
    } catch (cause) {
      lastError = cause;
      log.warn(`critique attempt ${attempt + 1} failed for ${slug}: ${cause.message}`);
    }
  }
  return { error: lastError?.message ?? 'unknown error' };
};

const run = async () => {
  const outDir = resolve(process.env.LG_OUT_DIR ?? 'out');
  const manifest = JSON.parse(await readFile(join(outDir, 'manifest.json'), 'utf8'));
  const rubricPath = process.env.LG_RUBRIC_PATH || 'design-rubric.yml';
  const rubric = await loadRubric(rubricPath);
  const prTitle = process.env.LG_PR_TITLE || '';
  const transport = selectTransport();
  const model = process.env.LG_MODEL || transport.defaultModel;
  log.info(`critique: transport=${transport.id} model=${model} rubric=${rubric.source}`);

  const groups = groupBySlug(manifest.entries);
  const critiques = {};
  for (const [slug, group] of groups) {
    // eslint-disable-next-line no-await-in-loop
    critiques[slug] = await critiqueOne(transport, slug, group, rubric, prTitle, model);
  }

  const critiquesPath = join(outDir, 'critiques.json');
  await writeFile(critiquesPath, `${JSON.stringify({ model, transport: transport.id, rubricSource: rubric.source, critiques }, null, 2)}\n`);
  log.info(`critiques written ${critiquesPath}`);
  process.stdout.write(`${critiquesPath}\n`);
};

run().catch((err) => {
  log.error(err.stack || err.message);
  process.exit(1);
});
