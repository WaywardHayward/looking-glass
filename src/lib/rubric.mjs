// design-rubric.yml loader + validator with safe defaults.

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import YAML from 'yaml';

const DEFAULT_RUBRIC = Object.freeze({
  brand: {
    voice: 'clear, confident, friendly',
    tone: 'modern, accessible'
  },
  visual: {
    rules: [
      'consistent spacing rhythm',
      'clear visual hierarchy',
      'no orphaned elements',
      'mobile layout has no horizontal scroll'
    ]
  },
  primaryActions: {},
  journeys: []
});

const isPlainObject = (value) =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * @param {string} path
 * @returns {Promise<string|null>}
 */
const safeReadFile = async (path) => {
  if (!existsSync(path)) return null;
  return readFile(path, 'utf8');
};

/**
 * @param {string} raw
 * @returns {unknown}
 */
const parseYaml = (raw) => {
  try {
    return YAML.parse(raw);
  } catch (cause) {
    throw new Error(`rubric YAML is invalid: ${cause.message}`);
  }
};

/**
 * @param {Record<string, unknown>} rubric
 * @returns {void}
 */
const assertShape = (rubric) => {
  if (!isPlainObject(rubric)) {
    throw new Error('rubric root must be an object');
  }
  if (rubric.brand !== undefined && !isPlainObject(rubric.brand)) {
    throw new Error('rubric.brand must be an object');
  }
  if (rubric.visual !== undefined && !isPlainObject(rubric.visual)) {
    throw new Error('rubric.visual must be an object');
  }
  if (
    rubric.journeys !== undefined &&
    !Array.isArray(rubric.journeys)
  ) {
    throw new Error('rubric.journeys must be an array');
  }
};

/**
 * Merge a parsed rubric with defaults so consumers always get every section.
 *
 * @param {unknown} parsed
 * @returns {{brand: object, visual: object, primaryActions: object, journeys: Array<unknown>}}
 */
const mergeWithDefaults = (parsed) => ({
  brand: { ...DEFAULT_RUBRIC.brand, ...(parsed?.brand ?? {}) },
  visual: { ...DEFAULT_RUBRIC.visual, ...(parsed?.visual ?? {}) },
  primaryActions: { ...(parsed?.primaryActions ?? {}) },
  journeys: Array.isArray(parsed?.journeys) ? parsed.journeys : []
});

/**
 * Load a design rubric from disk. Missing file is fine; defaults are used.
 *
 * @param {string} path - path to the rubric YAML.
 * @returns {Promise<{brand: object, visual: object, primaryActions: object, journeys: Array<unknown>, source: string}>}
 */
export const loadRubric = async (path) => {
  const raw = await safeReadFile(path);
  if (raw === null) {
    return { ...mergeWithDefaults({}), source: 'default' };
  }
  const parsed = parseYaml(raw);
  if (parsed === null || parsed === undefined) {
    return { ...mergeWithDefaults({}), source: 'default' };
  }
  assertShape(parsed);
  return { ...mergeWithDefaults(parsed), source: path };
};

/**
 * Extract the rubric slice relevant to a single page slug.
 *
 * @param {ReturnType<typeof loadRubric> extends Promise<infer R> ? R : never} rubric
 * @param {string} slug
 * @returns {{brand: object, visual: object, primaryAction: unknown, journeys: Array<unknown>}}
 */
export const rubricForSlug = (rubric, slug) => ({
  brand: rubric.brand,
  visual: rubric.visual,
  primaryAction: rubric.primaryActions?.[slug] ?? null,
  journeys: rubric.journeys.filter((entry) =>
    Array.isArray(entry?.includes) ? entry.includes.includes(slug) : false
  )
});

export const defaultRubric = () => ({ ...mergeWithDefaults({}), source: 'default' });
