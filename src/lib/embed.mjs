// Pure-ish helpers for embedding screenshots as base64 data URIs in PR comments.
// Sharp is imported lazily so unit tests that do not embed can stay fast.

import { existsSync } from 'node:fs';

export const MAX_COMMENT_CHARS = 55000;
export const THUMB_WIDTH = 200;
export const THUMB_QUALITY = 70;
const DATA_URI_PREFIX = 'data:image/jpeg;base64,';

let sharpModule = null;

const loadSharp = async () => {
  if (sharpModule) return sharpModule;
  const mod = await import('sharp');
  sharpModule = mod.default ?? mod;
  return sharpModule;
};

/**
 * Render a JPEG thumbnail of the given screenshot as a data URI string.
 * Returns null if the file is missing or sharp fails.
 * @param {string} path
 * @returns {Promise<string|null>}
 */
export const thumbnailToDataUri = async (path) => {
  if (!path || !existsSync(path)) return null;
  try {
    const sharp = await loadSharp();
    const buf = await sharp(path)
      .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
      .jpeg({ quality: THUMB_QUALITY })
      .toBuffer();
    return `${DATA_URI_PREFIX}${buf.toString('base64')}`;
  } catch {
    return null;
  }
};

/**
 * Build a map of screenshot absolute path -> data URI for all entries that
 * point at existing files. Missing files and capture errors are skipped.
 * @param {Array<{file?: string, error?: string}>} entries
 * @returns {Promise<Map<string, string>>}
 */
export const buildEmbedMap = async (entries) => {
  const map = new Map();
  for (const entry of entries ?? []) {
    if (!entry || entry.error || !entry.file) continue;
    const uri = await thumbnailToDataUri(entry.file);
    if (uri) map.set(entry.file, uri);
  }
  return map;
};

/**
 * Build the artefact ZIP link for the workflow run.
 * @param {string} runUrl
 * @returns {string|null}
 */
export const artefactDownloadUrl = (runUrl) => {
  if (!runUrl) return null;
  return `${runUrl}#artifacts`;
};

/**
 * Best-effort header line linking to the run's artefacts page.
 * @param {string} runUrl
 * @returns {string}
 */
export const artefactDownloadLine = (runUrl) => {
  const href = artefactDownloadUrl(runUrl);
  if (!href) return '';
  return `📦 [Download full screenshots](${href})`;
};
