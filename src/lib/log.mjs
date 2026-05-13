// Tiny stderr-only logger. Stdout is reserved for structured outputs.
// Levels: info, warn, error, debug (debug requires LOOKING_GLASS_DEBUG=1).

const PREFIX = '🪞 looking-glass';
const DEBUG_ENV = 'LOOKING_GLASS_DEBUG';

const isDebug = () => process.env[DEBUG_ENV] === '1';

/**
 * @param {string} level
 * @param {string} message
 * @returns {void}
 */
const write = (level, message) => {
  process.stderr.write(`${PREFIX} [${level}] ${message}\n`);
};

/** @param {string} message */
export const info = (message) => write('info', message);

/** @param {string} message */
export const warn = (message) => write('warn', message);

/** @param {string} message */
export const error = (message) => write('error', message);

/** @param {string} message */
export const debug = (message) => {
  if (!isDebug()) return;
  write('debug', message);
};
