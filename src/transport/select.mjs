// Auto-select transport based on environment.
// - In GitHub Actions (GITHUB_ACTIONS=true) → gh-models REST
// - Otherwise → openclaw CLI

import * as ghModels from './gh-models.mjs';
import * as openclaw from './openclaw.mjs';
import { DEFAULT_MODELS } from './payload.mjs';

const IS_ACTIONS_ENV = 'GITHUB_ACTIONS';

const isGitHubActions = () => process.env[IS_ACTIONS_ENV] === 'true';

/**
 * @returns {{id: string, run: typeof ghModels.run | typeof openclaw.run, defaultModel: string}}
 */
export const selectTransport = () => {
  if (isGitHubActions()) {
    return { id: ghModels.id, run: ghModels.run, defaultModel: DEFAULT_MODELS.githubActions };
  }
  return { id: openclaw.id, run: openclaw.run, defaultModel: DEFAULT_MODELS.openclaw };
};

export { DEFAULT_MODELS };
