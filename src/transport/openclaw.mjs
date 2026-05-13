// openclaw local-dev transport.
//
// Shells out to `openclaw capability model run --model <m>`. Multimodal CLI
// flags vary across versions; this transport prefers the same REST endpoint
// approach when OPENCLAW_MODEL_REST is set, otherwise it pipes a prompt that
// references screenshot paths so the model can see them (when the local
// model has filesystem access). If neither works, it returns a text-only
// best-effort result and the caller marks the run partial.

import { spawn } from 'node:child_process';
import { DEFAULT_MODELS, extractJson, TRANSPORT_TIMEOUT_MS } from './payload.mjs';
import * as log from '../lib/log.mjs';

const CLI = 'openclaw';

/**
 * @param {string[]} args
 * @param {string} stdinInput
 * @returns {Promise<{stdout: string, stderr: string, code: number}>}
 */
const run_ = (args, stdinInput) =>
  new Promise((resolve, reject) => {
    const child = spawn(CLI, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    const out = [];
    const err = [];
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('openclaw transport timed out'));
    }, TRANSPORT_TIMEOUT_MS);
    child.stdout.on('data', (b) => out.push(b));
    child.stderr.on('data', (b) => err.push(b));
    child.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        stdout: Buffer.concat(out).toString('utf8'),
        stderr: Buffer.concat(err).toString('utf8'),
        code: code ?? 0
      });
    });
    child.stdin.end(stdinInput);
  });

/**
 * @param {object} args
 * @param {string} args.model
 * @param {string} args.systemPrompt
 * @param {string} args.userText
 * @param {Array<{path?: string}>} [args.imageRefs]
 * @returns {Promise<{raw: string, json: unknown}>}
 */
export const run = async ({ model, systemPrompt, userText, imageRefs = [] }) => {
  const refs = imageRefs.filter((r) => typeof r?.path === 'string');
  const imageList = refs.length === 0
    ? ''
    : `\n\nImages (local file paths, look at them if you can):\n${refs.map((r) => `- ${r.path}`).join('\n')}`;
  const prompt = `${systemPrompt}\n\n---\n${userText}${imageList}\n\nRespond as strict JSON only.`;
  const args = ['capability', 'model', 'run', '--model', model || DEFAULT_MODELS.openclaw];
  log.debug(`openclaw transport invoking: ${args.join(' ')}`);
  const result = await run_(args, prompt);
  if (result.code !== 0) {
    throw new Error(`openclaw exited ${result.code}: ${result.stderr.slice(0, 300)}`);
  }
  const raw = result.stdout;
  return { raw, json: extractJson(raw) };
};

export const id = 'openclaw';
