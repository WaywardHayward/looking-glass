// GitHub Models REST transport.
//
// Why not `gh models run`? The CLI is text-only at time of writing (no image
// attachment flag, ChatMessage.Content is *string). The REST endpoint behind
// it accepts the OpenAI-compatible chat completions schema, which DOES support
// multimodal content parts via image_url with data: URIs. We hit it directly
// using GITHUB_TOKEN, which is also what `gh models` does under the hood.

import { buildUserMessage, extractJson, DEFAULT_MODELS, TRANSPORT_TIMEOUT_MS } from './payload.mjs';
import * as log from '../lib/log.mjs';

const ENDPOINT = 'https://models.github.ai/inference/chat/completions';
const FALLBACK_ENDPOINT = 'https://models.inference.ai.azure.com/chat/completions';

const getToken = () => {
  const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
  if (!token) {
    throw new Error('GITHUB_TOKEN (or GH_TOKEN) is required for gh-models transport');
  }
  return token;
};

/**
 * @param {string} endpoint
 * @param {string} token
 * @param {object} body
 * @returns {Promise<Response>}
 */
const postOnce = (endpoint, token, body) =>
  fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      accept: 'application/json'
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TRANSPORT_TIMEOUT_MS)
  });

/**
 * @param {string} token
 * @param {object} body
 * @returns {Promise<{content: string, endpoint: string}>}
 */
const callApi = async (token, body) => {
  const primary = await postOnce(ENDPOINT, token, body);
  if (primary.ok) {
    return { content: await extractContent(primary), endpoint: ENDPOINT };
  }
  log.warn(`primary endpoint ${primary.status}, trying fallback`);
  const fallback = await postOnce(FALLBACK_ENDPOINT, token, body);
  if (!fallback.ok) {
    const detail = await fallback.text().catch(() => '');
    throw new Error(
      `gh-models transport failed: ${fallback.status} ${fallback.statusText} ${detail.slice(0, 200)}`
    );
  }
  return { content: await extractContent(fallback), endpoint: FALLBACK_ENDPOINT };
};

/**
 * @param {Response} res
 * @returns {Promise<string>}
 */
const extractContent = async (res) => {
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') {
    throw new Error(`unexpected response shape: ${JSON.stringify(data).slice(0, 300)}`);
  }
  return content;
};

/**
 * Run a single chat completion with optional image attachments.
 *
 * @param {object} args
 * @param {string} args.model
 * @param {string} args.systemPrompt
 * @param {string} args.userText
 * @param {Array<{base64: string, mimeType?: string}>} [args.images]
 * @param {boolean} [args.jsonMode]
 * @returns {Promise<{raw: string, json: unknown}>}
 */
export const run = async ({ model, systemPrompt, userText, images = [], jsonMode = true }) => {
  const token = getToken();
  const body = {
    model: model || DEFAULT_MODELS.githubActions,
    messages: [
      { role: 'system', content: systemPrompt },
      buildUserMessage(userText, images)
    ],
    temperature: 0.4,
    max_tokens: 800
  };
  if (jsonMode) body.response_format = { type: 'json_object' };
  const { content } = await callApi(token, body);
  return { raw: content, json: jsonMode ? extractJson(content) : null };
};

export const id = 'gh-models';
