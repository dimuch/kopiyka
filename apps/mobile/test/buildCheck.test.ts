import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BANNED_IN_DEMO,
  bannedInDemo,
  type Build,
  listDifferences,
  moduleList,
  productionProblems,
} from '../scripts/buildCheck.mjs';

const demo = (modules: string[], text = 'root:"src/demo-app"'): Build => ({ modules, text });

describe('moduleList', () => {
  it('keeps app files, names packages once, drops virtual modules and the route folder’s query', () => {
    expect(
      moduleList([
        '__prelude__',
        '\0shim:react-native-web/dist/exports/AppRegistry/AppContainer.js',
        '/apps/mobile/src/demo-app?ctx=c9915d5ced2b656047aa496292a87964b21f4221',
        '/apps/mobile/src/data/useMonth.ts',
        '/node_modules/react/index.js',
        '/node_modules/react/cjs/react.production.js',
        '/node_modules/@expo/metro-runtime/build/index.js',
        '/node_modules/react-native-web/node_modules/@react-native/normalize-colors/index.js',
        '/node_modules/react-native-web/node_modules/memoize-one/dist/memoize-one.esm.js',
        '/node_modules/standard-navigation/lib/src/index.js',
      ]),
    ).toEqual([
      '@expo/metro-runtime',
      '@react-native/normalize-colors',
      'memoize-one',
      'react',
      'src/data/useMonth.ts',
      'src/demo-app',
      'standard-navigation',
    ]);
  });
});

describe('bannedInDemo', () => {
  it.each([
    'src/app/_layout.tsx',
    'src/app/(tabs)/index.tsx',
    'src/app/(tabs)/settings.tsx',
    'src/app/(tabs)/statistics.tsx',
    'src/app/login.tsx',
    'src/app/members.tsx',
    'src/app/no-ledger.tsx',
    'src/api/client.ts',
    'src/api/baseUrl.ts',
    'src/auth/AuthContext.tsx',
    'src/auth/ledgerChoice.ts',
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
  ])('refuses %s', (module) => {
    expect(bannedInDemo(demo(['src/demo/client.ts', module]))).toEqual([`banned module ${module}`]);
  });

  it.each([
    ['/api/auth/login', 'fetch("/api/auth/login")'],
    ['Statistics', 'title:"Statistics"'],
    ['notion, in any case', 'useNotionSync'],
    ['notion, in any case', 'NOTION'],
  ])('refuses the text %s', (name, text) => {
    expect(bannedInDemo(demo([], `root:"src/demo-app";${text}`))).toEqual([`banned text: ${name}`]);
  });

  it('bans only paths that exist, so a renamed file can’t drop out of the ban unnoticed', () => {
    const missing = BANNED_IN_DEMO.filter((banned) => banned.startsWith('src/')).filter(
      (banned) => !existsSync(join(__dirname, '..', banned)),
    );

    expect(missing).toEqual([]);
  });

  it('passes CategoryPicker, apiError and the date picker package', () => {
    expect(
      bannedInDemo(
        demo(['src/components/CategoryPicker.tsx', 'src/api/apiError.ts', '@react-native-community/datetimepicker']),
      ),
    ).toEqual([]);
  });

  it('refuses a build with production’s app config', () => {
    expect(bannedInDemo(demo(['src/demo/client.ts'], 'root:"src/app"'))).toEqual([
      'no src/demo-app in its app config: built as production',
    ]);
  });
});

describe('listDifferences', () => {
  it('names new and removed modules', () => {
    expect(listDifferences(['react', 'src/demo/client.ts'], ['react', 'src/demo/old.ts'])).toEqual([
      'new module: src/demo/client.ts',
      'gone from the demo: src/demo/old.ts',
    ]);
  });

  it('is empty when the list matches', () => {
    expect(listDifferences(['react'], ['react'])).toEqual([]);
  });
});

describe('productionProblems', () => {
  const production = ['src/app/_layout.tsx', 'src/api/client.ts'];

  it('passes a production build', () => {
    expect(productionProblems({ modules: production, text: 'root:"src/app"' })).toEqual([]);
  });

  it('refuses a demo module and the demo’s app config', () => {
    expect(
      productionProblems({
        modules: [...production, 'src/demo/store.ts', 'src/demo-app'],
        text: 'root:"src/demo-app"',
      }),
    ).toEqual(['demo module src/demo/store.ts', 'demo module src/demo-app', 'src/demo-app in its app config']);
  });

  it('refuses a build that isn’t production', () => {
    expect(productionProblems({ modules: ['src/demo/client.ts'], text: '' })).toEqual([
      'demo module src/demo/client.ts',
      'missing src/app/_layout.tsx',
      'missing src/api/client.ts',
    ]);
  });
});

describe('the flavour', () => {
  it('is named nowhere in src', () => {
    const named: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) walk(path);
        else if (readFileSync(path, 'utf8').includes('KOPIYKA_FLAVOUR')) named.push(path);
      }
    };
    walk(join(__dirname, '..', 'src'));

    expect(named).toEqual([]);
  });
});
