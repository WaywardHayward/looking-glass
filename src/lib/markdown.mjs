// Pure functions for composing the looking-glass markdown artefact.
// No filesystem, no env, no globals. Easy to test.

import { relative } from 'node:path';

export const COMMENT_MARKER = '<!-- looking-glass -->';
export const VERDICT_ORDER = Object.freeze(['🟢', '🟡', '🔴']);

/**
 * @param {Array<{slug: string}>} entries
 * @returns {Map<string, Array<object>>}
 */
export const groupBySlug = (entries) => {
  const groups = new Map();
  for (const entry of entries) {
    const list = groups.get(entry.slug) ?? [];
    list.push(entry);
    groups.set(entry.slug, list);
  }
  return groups;
};

/**
 * @param {Record<string, {verdict?: string, error?: string}> | undefined} critiques
 * @returns {string}
 */
export const summariseVerdicts = (critiques) => {
  const counts = new Map(VERDICT_ORDER.map((v) => [v, 0]));
  let errors = 0;
  for (const entry of Object.values(critiques ?? {})) {
    if (entry?.error) { errors += 1; continue; }
    if (counts.has(entry?.verdict)) counts.set(entry.verdict, counts.get(entry.verdict) + 1);
  }
  const total = Object.keys(critiques ?? {}).length;
  const parts = VERDICT_ORDER.map((v) => `${counts.get(v)}${v}`);
  if (errors > 0) parts.push(`${errors}⚠️`);
  return `${total} page${total === 1 ? '' : 's'}: ${parts.join(' ')}`;
};

/**
 * @param {{partial?: boolean}} manifest
 * @param {{captions?: Record<string, {error?: string}>}|null} captionsData
 * @param {{critiques?: Record<string, {error?: string}>}|null} critiquesData
 * @returns {'ok'|'partial'}
 */
export const overallStatus = (manifest, captionsData, critiquesData) => {
  if (manifest?.partial) return 'partial';
  const captionErr = captionsData
    && Object.values(captionsData.captions || {}).some((c) => c?.error);
  const critiqueErr = critiquesData
    && Object.values(critiquesData.critiques || {}).some((c) => c?.error);
  if (captionErr || critiqueErr) return 'partial';
  return 'ok';
};

const renderShotCell = (entry, outDir) => {
  if (!entry) return 'n/a';
  if (entry.error) return `⚠️ capture failed: ${entry.error}`;
  return `![${entry.viewport}](${relative(outDir, entry.file)})`;
};

const renderCaption = (captionsByKey, key) => {
  const entry = captionsByKey?.[key];
  if (!entry) return '_(captions disabled)_';
  if (entry.error) return `⚠️ caption error: ${entry.error}`;
  return entry.caption;
};

const renderCritique = (critique) => {
  if (!critique) return { verdictLine: '⚪ (critique disabled)', body: '' };
  if (critique.error) return { verdictLine: `⚠️ critique error: ${critique.error}`, body: '' };
  const obsLines = critique.observations
    .map((line, i) => `${i + 1}. ${String(line).replace(/^\d+\.\s*/, '')}`)
    .join('\n');
  return {
    verdictLine: `${critique.verdict} ${critique.summary}`,
    body: `**Critique.**\n${obsLines}`
  };
};

/**
 * @param {string} slug
 * @param {Array<object>} group
 * @param {Record<string, object>|undefined} captionsByKey
 * @param {object|undefined} critique
 * @param {{routes: Array<{slug: string, url: string}>}} manifest
 * @param {string} outDir
 * @returns {string}
 */
export const renderSection = (slug, group, captionsByKey, critique, manifest, outDir) => {
  const label = group[0]?.label ?? slug;
  const route = manifest.routes.find((r) => r.slug === slug);
  const desktop = group.find((g) => g.viewport === 'desktop');
  const mobile = group.find((g) => g.viewport === 'mobile');
  const { verdictLine, body } = renderCritique(critique);
  return [
    `## ${label} - \`${route?.url ?? '/'}\``,
    '',
    `Verdict: ${verdictLine}`,
    '',
    '| Desktop | Mobile |',
    '|---------|--------|',
    `| ${renderShotCell(desktop, outDir)} | ${renderShotCell(mobile, outDir)} |`,
    '',
    `**Caption (desktop).** ${renderCaption(captionsByKey, `${slug}__desktop`)}`,
    '',
    `**Caption (mobile).** ${renderCaption(captionsByKey, `${slug}__mobile`)}`,
    '',
    body,
    '',
    '---',
    ''
  ].join('\n');
};

/**
 * @param {object} args
 * @returns {string}
 */
export const renderArtefact = ({ manifest, captionsData, critiquesData, prTitle, prNumber, outDir, generatedAt }) => {
  const summary = summariseVerdicts(critiquesData?.critiques);
  const status = overallStatus(manifest, captionsData, critiquesData);
  const model = critiquesData?.model || captionsData?.model || '(none)';
  const groups = groupBySlug(manifest.entries);
  const header = [
    COMMENT_MARKER,
    '# 🪞 looking-glass review',
    '',
    `PR: ${prTitle || '(unknown)'} (#${prNumber || '?'})`,
    `Base URL: ${manifest.baseUrl}`,
    `Model: ${model}`,
    `Status: ${status}`,
    `Generated: ${generatedAt}`,
    '',
    '## Summary',
    summary,
    '',
    '---',
    ''
  ].join('\n');
  const sections = [...groups.entries()].map(([slug, group]) =>
    renderSection(slug, group, captionsData?.captions, critiquesData?.critiques?.[slug], manifest, outDir)
  );
  return { body: `${header}${sections.join('')}`, summary, status };
};
