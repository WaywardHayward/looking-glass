// Per-shot editorial caption.
//
// Reads <out>/manifest.json, generates a 2-3 line caption for each shot,
// writes <out>/captions.json keyed by `${slug}__${viewport}`.
//
// Soft-fails: per-entry errors are recorded as { error } rather than thrown.

import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { selectTransport } from './transport/select.mjs';
import { loadImageForTransport } from './lib/image.mjs';
import * as log from './lib/log.mjs';

const SYSTEM_PROMPT = [
  'You are an editorial UX critic writing captions for a visual PR review.',
  'Look at the screenshot. Write 2-3 short sentences describing what the user sees and what this page is for.',
  'Avoid hedging. Avoid em dashes. Avoid markdown. Plain prose only.',
  'Respond as strict JSON: {"caption": "..."}'
].join(' ');

const MAX_RETRIES = 1;

const buildUserText = (entry) =>
  [
    `Slug: ${entry.slug}`,
    `Label: ${entry.label}`,
    `Viewport: ${entry.viewport}`,
    'Write the caption now.'
  ].join('\n');

/**
 * @param {ReturnType<typeof selectTransport>} transport
 * @param {object} entry
 * @param {string} model
 * @returns {Promise<{caption?: string, error?: string}>}
 */
const captionOne = async (transport, entry, model) => {
  if (entry.error) {
    return { error: `skipped (capture error: ${entry.error})` };
  }
  const image = await loadImageForTransport(entry.file, transport.id);
  const payload = {
    model,
    systemPrompt: SYSTEM_PROMPT,
    userText: buildUserText(entry),
    images: image.images,
    imageRefs: image.imageRefs,
    jsonMode: true
  };
  let lastError;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const { json } = await transport.run(payload);
      const caption = json?.caption;
      if (typeof caption !== 'string' || caption.length === 0) {
        throw new Error('model returned empty caption');
      }
      return { caption: caption.trim() };
    } catch (cause) {
      lastError = cause;
      log.warn(`caption attempt ${attempt + 1} failed for ${entry.slug}/${entry.viewport}: ${cause.message}`);
    }
  }
  return { error: lastError?.message ?? 'unknown error' };
};

const run = async () => {
  const outDir = resolve(process.env.LG_OUT_DIR ?? 'out');
  const manifestPath = join(outDir, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const transport = selectTransport();
  const model = process.env.LG_MODEL || transport.defaultModel;
  log.info(`captions: transport=${transport.id} model=${model} entries=${manifest.entries.length}`);

  const captions = {};
  for (const entry of manifest.entries) {
    // eslint-disable-next-line no-await-in-loop
    const result = await captionOne(transport, entry, model);
    captions[`${entry.slug}__${entry.viewport}`] = result;
  }

  const captionsPath = join(outDir, 'captions.json');
  await writeFile(captionsPath, `${JSON.stringify({ model, transport: transport.id, captions }, null, 2)}\n`);
  log.info(`captions written ${captionsPath}`);
  process.stdout.write(`${captionsPath}\n`);
};

run().catch((err) => {
  log.error(err.stack || err.message);
  process.exit(1);
});
