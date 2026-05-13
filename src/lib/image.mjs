// Load a screenshot for the active transport.
// - gh-models: base64-inline as data URI (multimodal REST)
// - openclaw : pass a file path reference; the local model may read it

import { readFile, stat } from 'node:fs/promises';

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

/**
 * @param {string} path
 * @param {string} transportId
 * @returns {Promise<{images: Array<{base64: string, mimeType: string}>, imageRefs: Array<{path: string}>}>}
 */
export const loadImageForTransport = async (path, transportId) => {
  if (transportId === 'gh-models') {
    const info = await stat(path);
    if (info.size > MAX_IMAGE_BYTES) {
      throw new Error(`screenshot ${path} is ${info.size} bytes, exceeds ${MAX_IMAGE_BYTES}`);
    }
    const buf = await readFile(path);
    return {
      images: [{ base64: buf.toString('base64'), mimeType: 'image/png' }],
      imageRefs: []
    };
  }
  return { images: [], imageRefs: [{ path }] };
};
