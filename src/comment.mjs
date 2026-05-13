// Post or update the looking-glass PR comment using `gh api`.
// Soft-fails: never throws to caller. Returns 0 even on error.

import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import * as log from './lib/log.mjs';

const COMMENT_MARKER = '<!-- looking-glass -->';

/**
 * @param {string[]} args
 * @param {string} [stdinInput]
 * @returns {Promise<{stdout: string, stderr: string, code: number}>}
 */
const runGh = (args, stdinInput) =>
  new Promise((resolveP) => {
    const child = spawn('gh', args, { stdio: ['pipe', 'pipe', 'pipe'] });
    const out = [];
    const err = [];
    child.stdout.on('data', (b) => out.push(b));
    child.stderr.on('data', (b) => err.push(b));
    child.on('close', (code) => {
      resolveP({
        stdout: Buffer.concat(out).toString('utf8'),
        stderr: Buffer.concat(err).toString('utf8'),
        code: code ?? 0
      });
    });
    if (stdinInput !== undefined) child.stdin.end(stdinInput);
    else child.stdin.end();
  });

const requireEnv = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`missing required env var ${name}`);
  return value;
};

/**
 * @param {string} repo
 * @param {string} prNumber
 * @returns {Promise<number | null>}
 */
const findExistingComment = async (repo, prNumber) => {
  const result = await runGh([
    'api', `/repos/${repo}/issues/${prNumber}/comments`,
    '--paginate', '-q', `.[] | select(.body | startswith("${COMMENT_MARKER}")) | .id`
  ]);
  if (result.code !== 0) {
    log.warn(`could not list comments: ${result.stderr.slice(0, 200)}`);
    return null;
  }
  const firstId = result.stdout.split('\n').map((l) => l.trim()).find((l) => l.length > 0);
  return firstId ? Number(firstId) : null;
};

const updateComment = async (repo, commentId, body) => {
  const result = await runGh(
    ['api', '--method', 'PATCH', `/repos/${repo}/issues/comments/${commentId}`, '-f', `body=${body}`],
  );
  if (result.code !== 0) {
    log.warn(`comment update failed: ${result.stderr.slice(0, 200)}`);
    return false;
  }
  log.info(`updated comment ${commentId}`);
  return true;
};

const createComment = async (repo, prNumber, body) => {
  const result = await runGh(
    ['api', '--method', 'POST', `/repos/${repo}/issues/${prNumber}/comments`, '-f', `body=${body}`],
  );
  if (result.code !== 0) {
    log.warn(`comment create failed: ${result.stderr.slice(0, 200)}`);
    return false;
  }
  log.info(`created PR comment`);
  return true;
};

const buildBody = (artefactBody, runUrl) => {
  const footer = runUrl ? `\n\n_See full artefact in [the workflow run](${runUrl})._` : '';
  return `${artefactBody}${footer}`;
};

const run = async () => {
  const repo = requireEnv('GITHUB_REPOSITORY');
  const prNumber = process.env.LG_PR_NUMBER;
  if (!prNumber) {
    log.info('no PR number, skipping comment');
    return;
  }
  const outDir = resolve(process.env.LG_OUT_DIR ?? 'out');
  const artefactPath = join(outDir, 'looking-glass.md');
  const body = buildBody(await readFile(artefactPath, 'utf8'), process.env.LG_RUN_URL || '');
  const existingId = await findExistingComment(repo, prNumber);
  if (existingId) {
    await updateComment(repo, existingId, body);
    return;
  }
  await createComment(repo, prNumber, body);
};

run().catch((err) => {
  log.error(`comment soft-fail: ${err.message}`);
  process.exit(0);
});
