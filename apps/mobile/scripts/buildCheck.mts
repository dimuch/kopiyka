// Brief 080: checks that each web build holds only what it should. The demo build must not contain the modules and text
// it doesn't use, and its module list must match demo-modules.txt, so a new module reaching the demo is a visible change
// in a PR. The production build must contain nothing of the demo's.

/** A web export, as its source maps and bundle text show it. */
export interface Build {
  /** Its module list (`moduleList`). */
  modules: string[];
  /** Every bundle file's text, joined. */
  text: string;
}

const APP_ROOT = '/apps/mobile/';
const NODE_MODULES = '/node_modules/';

/**
 * A build's modules from its source-map sources, which are root-relative: app files by path from apps/mobile
 * ('src/data/useMonth.ts'), packages once by name (nested and scoped ones too). Virtual modules ('__prelude__',
 * '\0shim:…') are dropped, and so is a route folder's `?ctx=` query.
 */
export function moduleList(sources: readonly string[]): string[] {
  const modules = new Set<string>();
  for (const source of sources) {
    if (!source.startsWith('/')) continue;
    const path = source.split('?')[0]!;
    const packageStart = path.lastIndexOf(NODE_MODULES);
    if (packageStart >= 0) {
      const [scopeOrName = '', name = ''] = path.slice(packageStart + NODE_MODULES.length).split('/');
      modules.add(scopeOrName.startsWith('@') ? `${scopeOrName}/${name}` : scopeOrName);
    } else {
      modules.add(path.startsWith(APP_ROOT) ? path.slice(APP_ROOT.length) : path.slice(1));
    }
  }
  return [...modules].sort();
}

/** App modules the demo never uses (brief 080's first criterion), as paths or folders from apps/mobile. */
const BANNED_IN_DEMO = [
  'src/app/_layout.tsx',
  'src/app/(tabs)/index.tsx',
  'src/app/(tabs)/settings.tsx',
  'src/app/(tabs)/statistics.tsx',
  'src/app/login.tsx',
  'src/app/members.tsx',
  'src/app/no-ledger.tsx',
  'src/api/client.ts',
  'src/api/baseUrl.ts',
  'src/auth/',
  'src/data/invites.tsx',
  'src/data/tabItems.ts',
  'src/tabs.ts',
  'src/components/NotionSyncPanel.tsx',
  'src/data/notionSync.ts',
  'src/data/useNotionSync.ts',
  'src/data/members.ts',
  'src/data/useMembers.ts',
  'src/components/LedgerPicker.tsx',
  'src/components/AppearancePicker.tsx',
  'expo-secure-store',
];

/** Text the demo's bundle must not hold: the sign-in route, Statistics, and Notion in any case. */
const BANNED_TEXT: readonly [string, RegExp][] = [
  ['/api/auth/login', /\/api\/auth\/login/],
  ['Statistics', /Statistics/],
  ['notion, in any case', /notion/i],
];

/** Expo bakes the app config into the bundle; only the demo's names its route folder. */
const DEMO_MANIFEST = 'src/demo-app';

/** Why the demo build is wrong: banned modules, banned text, or production's app config. Empty when it's fine. */
export function bannedInDemo(build: Build): string[] {
  const problems: string[] = [];
  for (const banned of BANNED_IN_DEMO) {
    for (const module of build.modules) {
      if (banned.endsWith('/') ? module.startsWith(banned) : module === banned)
        problems.push(`banned module ${module}`);
    }
  }
  for (const [name, pattern] of BANNED_TEXT) {
    if (pattern.test(build.text)) problems.push(`banned text: ${name}`);
  }
  if (!build.text.includes(DEMO_MANIFEST)) problems.push(`no ${DEMO_MANIFEST} in its app config: built as production`);
  return problems;
}

/** How a build's modules differ from the accepted list: both kinds fail, since the list must match. */
export function listDifferences(modules: readonly string[], accepted: readonly string[]): string[] {
  const listed = new Set(accepted);
  const built = new Set(modules);
  return [
    ...modules.filter((module) => !listed.has(module)).map((module) => `new module: ${module}`),
    ...accepted.filter((module) => !built.has(module)).map((module) => `gone from the demo: ${module}`),
  ];
}

/** Modules a production build must have, so a demo build in its place fails. */
const REQUIRED_IN_PRODUCTION = ['src/app/_layout.tsx', 'src/api/client.ts'];

/** Why the production build is wrong: demo modules or config in it, or production's own modules missing. */
export function productionProblems(build: Build): string[] {
  const problems = build.modules
    .filter((module) => module.startsWith('src/demo/') || module.startsWith('src/demo-app'))
    .map((module) => `demo module ${module}`);
  if (build.text.includes(DEMO_MANIFEST)) problems.push(`${DEMO_MANIFEST} in its app config`);
  for (const module of REQUIRED_IN_PRODUCTION) {
    if (!build.modules.includes(module)) problems.push(`missing ${module}`);
  }
  return problems;
}
