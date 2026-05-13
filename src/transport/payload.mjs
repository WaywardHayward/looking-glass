// Shared multimodal payload builder + JSON-mode response parser.
// Used by both gh-models and openclaw transports.

/**
 * @typedef {{type: 'text', text: string}} TextPart
 * @typedef {{type: 'image_url', image_url: {url: string, detail?: 'low'|'high'|'auto'}}} ImagePart
 * @typedef {TextPart | ImagePart} ContentPart
 * @typedef {{role: 'system'|'user'|'assistant', content: string | ContentPart[]}} ChatMessage
 */

/**
 * Build a multimodal user message with optional image attachments.
 *
 * @param {string} text
 * @param {Array<{base64: string, mimeType?: string}>} images
 * @returns {ChatMessage}
 */
export const buildUserMessage = (text, images = []) => {
  if (images.length === 0) {
    return { role: 'user', content: text };
  }
  const parts = [
    { type: 'text', text },
    ...images.map((img) => ({
      type: 'image_url',
      image_url: {
        url: `data:${img.mimeType ?? 'image/png'};base64,${img.base64}`,
        detail: 'high'
      }
    }))
  ];
  return { role: 'user', content: parts };
};

/**
 * Attempt to extract a JSON object from a model response.
 * Models sometimes wrap JSON in code fences or prose; this tolerates both.
 *
 * @param {string} raw
 * @returns {unknown}
 */
export const extractJson = (raw) => {
  if (typeof raw !== 'string' || raw.length === 0) {
    throw new Error('empty model response');
  }
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : raw;
  const trimmed = candidate.trim();
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace <= firstBrace) {
    throw new Error(`response is not JSON-shaped: ${truncate(raw)}`);
  }
  const slice = trimmed.slice(firstBrace, lastBrace + 1);
  try {
    return JSON.parse(slice);
  } catch (cause) {
    throw new Error(`response JSON parse failed: ${cause.message}`);
  }
};

/** @param {string} s */
const truncate = (s) => (s.length > 200 ? `${s.slice(0, 200)}...` : s);

export const DEFAULT_MODELS = Object.freeze({
  githubActions: 'openai/gpt-4o',
  openclaw: 'github-copilot/claude-opus-4.7'
});

export const TRANSPORT_TIMEOUT_MS = 120_000;
