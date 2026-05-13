// Routes input parser + validator.
// Input is a JSON string: array of { slug, url, label }.

const REQUIRED_KEYS = ['slug', 'url', 'label'];
const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
const isPlainObject = (value) =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * @param {string} raw
 * @returns {unknown}
 */
const parseJson = (raw) => {
  try {
    return JSON.parse(raw);
  } catch (cause) {
    throw new Error(`routes input is not valid JSON: ${cause.message}`);
  }
};

/**
 * @param {Record<string, unknown>} entry
 * @param {number} index
 * @returns {void}
 */
const assertRequiredKeys = (entry, index) => {
  for (const key of REQUIRED_KEYS) {
    if (typeof entry[key] !== 'string' || entry[key].length === 0) {
      throw new Error(
        `routes[${index}] missing required string field "${key}"`
      );
    }
  }
};

/**
 * @param {string} slug
 * @param {number} index
 * @returns {void}
 */
const assertSlugShape = (slug, index) => {
  if (SLUG_PATTERN.test(slug)) return;
  throw new Error(
    `routes[${index}].slug "${slug}" must match ${SLUG_PATTERN}`
  );
};

/**
 * @param {string} url
 * @param {number} index
 * @returns {void}
 */
const assertUrlShape = (url, index) => {
  if (url.startsWith('/') || url.startsWith('http')) return;
  throw new Error(
    `routes[${index}].url "${url}" must start with "/" or "http"`
  );
};

/**
 * @param {unknown} entry
 * @param {number} index
 * @returns {{slug: string, url: string, label: string}}
 */
const normaliseEntry = (entry, index) => {
  if (!isPlainObject(entry)) {
    throw new Error(`routes[${index}] must be an object`);
  }
  assertRequiredKeys(entry, index);
  const slug = String(entry.slug);
  const url = String(entry.url);
  const label = String(entry.label);
  assertSlugShape(slug, index);
  assertUrlShape(url, index);
  return { slug, url, label };
};

/**
 * Parse the routes input string into a normalised array.
 *
 * @param {string} raw - JSON array string.
 * @returns {Array<{slug: string, url: string, label: string}>}
 */
export const parseRoutes = (raw) => {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    throw new Error('routes input is empty');
  }
  const parsed = parseJson(raw);
  if (!Array.isArray(parsed)) {
    throw new Error('routes input must be a JSON array');
  }
  if (parsed.length === 0) {
    throw new Error('routes input must contain at least one route');
  }
  return parsed.map(normaliseEntry);
};

/**
 * Parse a viewports JSON string into a normalised array.
 *
 * @param {string} raw - JSON array string.
 * @returns {Array<{name: string, width: number, height: number}>}
 */
export const parseViewports = (raw) => {
  const parsed = parseJson(raw);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('viewports input must be a non-empty JSON array');
  }
  return parsed.map((entry, index) => normaliseViewport(entry, index));
};

/**
 * @param {unknown} entry
 * @param {number} index
 * @returns {{name: string, width: number, height: number}}
 */
const normaliseViewport = (entry, index) => {
  if (!isPlainObject(entry)) {
    throw new Error(`viewports[${index}] must be an object`);
  }
  const name = entry.name;
  const width = entry.width;
  const height = entry.height;
  if (typeof name !== 'string' || name.length === 0) {
    throw new Error(`viewports[${index}].name must be a non-empty string`);
  }
  if (typeof width !== 'number' || width <= 0) {
    throw new Error(`viewports[${index}].width must be a positive number`);
  }
  if (typeof height !== 'number' || height <= 0) {
    throw new Error(`viewports[${index}].height must be a positive number`);
  }
  return { name, width, height };
};
