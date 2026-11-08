// The demo build (brief 080) swaps three modules for in-browser versions, so nothing it doesn't use is bundled: no API
// client, no sign-in, no invites. The normal build gets Expo's defaults untouched.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

if (process.env.KOPIYKA_FLAVOUR === 'demo') {
  // Metro's transform cache has no flavour in its key, and expo-constants bakes the app config into a cached transform:
  // without this, a build after the other flavour's ships that flavour's config.
  config.cacheVersion = 'demo';
  const swaps = {
    '@/api/client': 'src/demo/client.ts',
    '@/auth/AuthContext': 'src/demo/session.ts',
    '@/data/tabItems': 'src/demo/tabItems.ts',
  };
  const next = config.resolver.resolveRequest;
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    const swap = swaps[moduleName];
    if (swap) return { type: 'sourceFile', filePath: path.join(__dirname, swap) };
    return (next ?? context.resolveRequest)(context, moduleName, platform);
  };
}

module.exports = config;
