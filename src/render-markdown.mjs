// Thin wrapper around src/lib/markdown.mjs that handles disk I/O and outputs.

import { readFile, writeFile, appendFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { renderArtefact } from './lib/markdown.mjs';
import * as log from './lib/log.mjs';

const ARTEFACT_NAME = 'looking-glass.md';

const safeReadJson = async (path) => {
  if (!existsSync(path)) return null;
  return JSON.parse(await readFile(path, 'utf8'));
};

const writeOutput = async (name, value) => {
  const out = process.env.GITHUB_OUTPUT;
  if (!out) return;
  await appendFile(out, `${name}=${value}\n`);
};

const run = async () => {
  const outDir = resolve(process.env.LG_OUT_DIR ?? 'out');
  const manifest = await safeReadJson(join(outDir, 'manifest.json'));
  if (!manifest) throw new Error('manifest.json not found');
  const captionsData = await safeReadJson(join(outDir, 'captions.json'));
  const critiquesData = await safeReadJson(join(outDir, 'critiques.json'));
  const { body, summary, status } = renderArtefact({
    manifest,
    captionsData,
    critiquesData,
    prTitle: process.env.LG_PR_TITLE || '',
    prNumber: process.env.LG_PR_NUMBER || '',
    outDir,
    generatedAt: new Date().toISOString()
  });

  const artefactPath = join(outDir, ARTEFACT_NAME);
  await writeFile(artefactPath, body);
  log.info(`artefact written ${artefactPath} (${status})`);

  await writeOutput('artefact-path', artefactPath);
  await writeOutput('summary', summary);
  await writeOutput('status', status);
  process.stdout.write(`${artefactPath}\n`);
};

run().catch((err) => {
  log.error(err.stack || err.message);
  process.exit(1);
});
