import { execFileSync } from 'node:child_process';

export function buildInfo() {
  const git = (...args) => {
    try { return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
    catch { return 'unknown'; }
  };
  const revision = git('rev-parse', '--short=12', 'HEAD');
  const modified = git('status', '--porcelain') !== '';
  return {
    version: `${revision}${modified ? '-modified' : ''}`,
    revision,
    channel: process.env.BLUEK_BUILD_CHANNEL || process.env.GITHUB_REF_NAME || git('branch', '--show-current'),
    builtAt: new Date().toISOString(),
  };
}
