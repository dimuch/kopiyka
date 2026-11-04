import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const THIS_FILE = fileURLToPath(import.meta.url);
const APP_ROOT = resolve(dirname(THIS_FILE), '..');

/** Everything but this file, whose fixtures below are bad imports on purpose. */
function sourceFiles(): string[] {
  return ['test'].flatMap((folder) =>
    readdirSync(join(APP_ROOT, folder), { recursive: true, encoding: 'utf8' })
      .filter((file) => file.endsWith('.ts'))
      .map((file) => join(APP_ROOT, folder, file))
      .filter((file) => file !== THIS_FILE),
  );
}

function importSpecifiers(source: string): string[] {
  return [...source.matchAll(/(?:\bfrom\s+|\bimport\s*\(\s*|\bimport\s+)['"]([^'"]+)['"]/g)].flatMap((match) =>
    match[1] ? [match[1]] : [],
  );
}

/** Why a specifier may not be imported here, or null. `apps/mcp` must stay deletable, so it reaches the API over HTTP. */
function boundaryViolation(file: string, specifier: string): string | null {
  if (specifier.startsWith('@kopiyka/')) return `${specifier} is another workspace`;
  if (!specifier.startsWith('.')) return null;
  const target = relative(APP_ROOT, resolve(dirname(file), specifier));
  return target.startsWith('..') ? `${specifier} leaves apps/mcp` : null;
}

describe('the apps/mcp import boundary', () => {
  it('imports nothing from the other workspaces', () => {
    const violations = sourceFiles().flatMap((file) =>
      importSpecifiers(readFileSync(file, 'utf8')).flatMap((specifier) => {
        const violation = boundaryViolation(file, specifier);
        return violation ? [`${relative(APP_ROOT, file)}: ${violation}`] : [];
      }),
    );

    expect(violations).toEqual([]);
  });

  it.each([
    ["import { toCents } from '../../api/src/money.js';", '../../api/src/money.js leaves apps/mcp'],
    ["const money = await import('../../api/src/money.js');", '../../api/src/money.js leaves apps/mcp'],
    ["import '../../mobile/src/format.js';", '../../mobile/src/format.js leaves apps/mcp'],
    ["import { app } from '@kopiyka/api';", '@kopiyka/api is another workspace'],
  ])('catches %s', (source, violation) => {
    const file = join(APP_ROOT, 'src', 'app.ts');

    expect(importSpecifiers(source).map((specifier) => boundaryViolation(file, specifier))).toEqual([violation]);
  });

  it('allows imports inside apps/mcp and from packages', () => {
    const file = join(APP_ROOT, 'src', 'mcp', 'tools.ts');

    expect(boundaryViolation(file, '../config.js')).toBeNull();
    expect(boundaryViolation(file, 'fastify')).toBeNull();
  });
});
