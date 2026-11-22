import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { TEST_DB_URL } from './helpers.js';

const API_DIR = fileURLToPath(new URL('..', import.meta.url));
/** Any 32 bytes do: the importers never decrypt anything. */
const TOTP_ENC_KEY = Buffer.alloc(32, 7).toString('base64');

export interface ScriptResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

/**
 * Runs `script` (relative to apps/api) as its own process, with `test/offlineFetch.ts` preloaded so it can't reach the
 * network. The env is built here and never copies `process.env`: `test/setup.ts` loads `apps/api/.env`, which may hold
 * a real NOTION_TOKEN.
 */
export function runScript(script: string, args: string[], env: Record<string, string> = {}): Promise<ScriptResult> {
  return new Promise((resolve, reject) => {
    execFile(
      process.execPath,
      ['--import', 'tsx', '--import', './test/offlineFetch.ts', script, ...args],
      {
        cwd: API_DIR,
        env: { DATABASE_URL: TEST_DB_URL ?? 'mysql://unused@127.0.0.1:1/unused', TOTP_ENC_KEY, ...env },
      },
      (error, stdout, stderr) => {
        // A non-zero exit arrives as an error carrying the exit code; anything else (a spawn failure) is a test bug.
        if (error && typeof error.code !== 'number') return reject(error);
        resolve({ code: error ? (error.code as number) : 0, stdout, stderr });
      },
    );
  });
}
