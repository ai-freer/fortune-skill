import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// Node resolves the module URL through symlinks, while argv[1] may retain them.
// Imports from `node -e` have no argv[1]; importing must not run the CLI.
export function isMain(moduleURL) {
  if (!process.argv[1]) return false;
  try {
    return moduleURL === pathToFileURL(realpathSync(process.argv[1])).href;
  } catch {
    return false;
  }
}
