#!/usr/bin/env node
// Read-only store-readiness scanner for apps/mobile. Run from the repo root.
// Prints one line per check: PASS | WARN | FAIL | MANUAL  <id>  <message>.
// Exit code 1 when any check FAILs.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const mobile = join(root, 'apps/mobile');
const results = [];
const report = (level, id, msg) => results.push({ level, id, msg });

if (!existsSync(join(mobile, 'app.json'))) {
  console.error('Run from the kopiyka repo root (apps/mobile/app.json not found).');
  process.exit(2);
}

const expo = JSON.parse(readFileSync(join(mobile, 'app.json'), 'utf8')).expo ?? {};
const pkg = JSON.parse(readFileSync(join(mobile, 'package.json'), 'utf8'));
const deps = { ...pkg.dependencies, ...pkg.devDependencies };
const ios = expo.ios ?? {};
const android = expo.android ?? {};

// --- identity & versioning ---------------------------------------------------
expo.name ? report('PASS', 'meta', `name "${expo.name}"`) : report('FAIL', 'meta', 'expo.name missing');
/^\d+\.\d+\.\d+$/.test(expo.version ?? '')
  ? report('PASS', 'A14', `version ${expo.version}`)
  : report('FAIL', 'A14', `expo.version "${expo.version}" is not semver x.y.z`);
ios.bundleIdentifier
  ? report('PASS', 'A14', `ios.bundleIdentifier ${ios.bundleIdentifier}`)
  : report('FAIL', 'A14', 'ios.bundleIdentifier missing');
android.package
  ? report('PASS', 'G1', `android.package ${android.package}`)
  : report('FAIL', 'G1', 'android.package missing — required for Play, permanent once published');

const easPath = join(root, 'eas.json');
const easMobilePath = join(mobile, 'eas.json');
const eas = [easPath, easMobilePath].find(existsSync);
if (!eas) {
  report('WARN', 'build', 'no eas.json — no store build profiles (AAB/IPA, autoIncrement) configured');
} else {
  const easJson = JSON.parse(readFileSync(eas, 'utf8'));
  const prod = easJson.build?.production;
  prod
    ? report('PASS', 'build', `${relative(root, eas)} has a production profile`)
    : report('WARN', 'build', `${relative(root, eas)} has no build.production profile`);
  if (!prod?.autoIncrement && !ios.buildNumber) report('WARN', 'A14', 'no ios.buildNumber and no EAS autoIncrement');
  if (!prod?.autoIncrement && !android.versionCode)
    report('WARN', 'G2', 'no android.versionCode and no EAS autoIncrement');
}

// --- iOS config ----------------------------------------------------------------
ios.config?.usesNonExemptEncryption === false
  ? report('PASS', 'A8', 'usesNonExemptEncryption: false')
  : report(
      'WARN',
      'A8',
      'ios.config.usesNonExemptEncryption not set to false (export compliance asked on every build)',
    );

const pm = ios.privacyManifests;
if (!pm) {
  report(
    'WARN',
    'A7',
    'ios.privacyManifests missing — declare required-reason APIs (AsyncStorage → UserDefaults CA92.1)',
  );
} else {
  const cats = (pm.NSPrivacyAccessedAPITypes ?? []).map((t) => t.NSPrivacyAccessedAPIType);
  if (deps['@react-native-async-storage/async-storage'] && !cats.includes('NSPrivacyAccessedAPICategoryUserDefaults'))
    report('WARN', 'A7', 'privacyManifests lacks NSPrivacyAccessedAPICategoryUserDefaults (AsyncStorage)');
  else report('PASS', 'A7', `privacyManifests declares ${cats.length} API type(s)`);
}

const usageNeeds = {
  'expo-camera': ['NSCameraUsageDescription'],
  'expo-image-picker': ['NSPhotoLibraryUsageDescription', 'NSCameraUsageDescription'],
  'expo-media-library': ['NSPhotoLibraryUsageDescription'],
  'expo-location': ['NSLocationWhenInUseUsageDescription'],
  'expo-contacts': ['NSContactsUsageDescription'],
  'expo-local-authentication': ['NSFaceIDUsageDescription'],
};
const plist = ios.infoPlist ?? {};
const plugins = JSON.stringify(expo.plugins ?? []);
let permissionDeps = 0;
for (const [dep, keys] of Object.entries(usageNeeds)) {
  if (!deps[dep]) continue;
  permissionDeps++;
  for (const key of keys) {
    plist[key] || plugins.includes(dep)
      ? report('PASS', 'A10', `${dep}: ${key} provided (infoPlist or plugin config — check wording)`)
      : report('FAIL', 'A10', `${dep} installed but ${key} missing`);
  }
}
if (permissionDeps === 0) report('PASS', 'A10', 'no permission-gated Expo modules installed');

// --- Android config ------------------------------------------------------------
const perms = android.permissions ?? [];
const sensitive = perms.filter((p) =>
  /SMS|CALL_LOG|MANAGE_EXTERNAL_STORAGE|ACCESS_BACKGROUND_LOCATION|SCHEDULE_EXACT_ALARM|QUERY_ALL_PACKAGES|SYSTEM_ALERT_WINDOW/.test(
    p,
  ),
);
sensitive.length
  ? report('FAIL', 'G5', `sensitive permissions need Play declarations: ${sensitive.join(', ')}`)
  : report('PASS', 'G5', `android.permissions: ${perms.length ? perms.join(', ') : 'none declared explicitly'}`);
if (!android.blockedPermissions)
  report('WARN', 'G5', 'no android.blockedPermissions — check merged manifest for permissions added by libraries');

const rn = (deps['react-native'] ?? '')
  .replace(/[^\d.]/g, '')
  .split('.')
  .map(Number);
rn[0] > 0 || rn[1] >= 77
  ? report('PASS', 'G4', `react-native ${deps['react-native']} supports 16 KB pages`)
  : report('FAIL', 'G4', `react-native ${deps['react-native']} < 0.77 — no 16 KB page support`);
report('MANUAL', 'G3', `expo ${deps.expo}: confirm its targetSdkVersion meets Play's current requirement`);
report(
  'MANUAL',
  'A13',
  `expo ${deps.expo}: confirm the EAS build image uses the Xcode/iOS SDK Apple currently requires`,
);

// --- icons -----------------------------------------------------------------------
function pngInfo(file) {
  const buf = readFileSync(file);
  if (buf.toString('ascii', 1, 4) !== 'PNG') return null;
  const colorType = buf[25];
  const hasTRNS = buf.includes(Buffer.from('tRNS'));
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), alpha: colorType === 4 || colorType === 6 || hasTRNS };
}
const iconPath = join(mobile, ios.icon ?? expo.icon ?? '');
if (!expo.icon && !ios.icon) report('FAIL', 'A12', 'no app icon configured');
else if (!existsSync(iconPath)) report('FAIL', 'A12', `icon not found: ${relative(root, iconPath)}`);
else {
  const info = pngInfo(iconPath);
  if (!info) report('FAIL', 'A12', `${relative(root, iconPath)} is not a PNG`);
  else {
    info.w === 1024 && info.h === 1024
      ? report('PASS', 'A12', `icon 1024×1024`)
      : report('FAIL', 'A12', `icon is ${info.w}×${info.h}, App Store needs 1024×1024`);
    info.alpha
      ? report(
          'WARN',
          'A12',
          'icon PNG has an alpha channel — App Store icon must be opaque (EAS usually flattens; verify)',
        )
      : report('PASS', 'A12', 'icon has no alpha channel');
  }
}
const adaptive = android.adaptiveIcon ?? {};
for (const key of ['foregroundImage', 'backgroundImage', 'monochromeImage']) {
  if (adaptive[key] && !existsSync(join(mobile, adaptive[key])))
    report('FAIL', 'G11', `adaptiveIcon.${key} not found: ${adaptive[key]}`);
}
if (adaptive.foregroundImage) report('PASS', 'G11', 'adaptive icon configured');
else report('WARN', 'G11', 'no android.adaptiveIcon.foregroundImage');

// --- source scans ------------------------------------------------------------------
function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|jsx?)$/.test(name)) out.push(p);
  }
  return out;
}
function grep(files, re) {
  const hits = [];
  for (const f of files) {
    readFileSync(f, 'utf8')
      .split('\n')
      .forEach((line, i) => {
        if (re.test(line)) hits.push(`${relative(root, f)}:${i + 1}`);
      });
  }
  return hits;
}
const appFiles = walk(join(mobile, 'src'));
const apiFiles = walk(join(root, 'apps/api/src'));

const http = grep(appFiles, /['"`]http:\/\//);
http.length
  ? report('WARN', 'A9/G10', `plain http:// URLs (ensure none ship in release): ${http.join(', ')}`)
  : report('PASS', 'A9/G10', 'no http:// URLs in apps/mobile/src');

const privacy = grep(appFiles, /privacy/i);
privacy.length
  ? report('PASS', 'A4/G6', `privacy mentioned in app: ${privacy.slice(0, 3).join(', ')}`)
  : report('WARN', 'A4/G6', 'no privacy policy link found in apps/mobile/src');

const signup = grep(apiFiles, /\.(post|put)\(\s*['"`][^'"`]*(register|signup|sign-up)/i);
const delAccount = grep(apiFiles, /\.delete\(\s*['"`][^'"`]*(account|\/me|users?)\b/i);
if (signup.length && !delAccount.length)
  report('FAIL', 'A5/G7', `in-app sign-up (${signup.join(', ')}) without an account deletion route`);
else if (signup.length) report('PASS', 'A5/G7', `sign-up and deletion routes present: ${delAccount.join(', ')}`);
else
  report(
    'PASS',
    'A5/G7',
    'no in-app sign-up route — account deletion rule not triggered (re-check if sign-up is added)',
  );

const placeholders = grep(appFiles, /lorem ipsum|coming soon|not implemented/i);
placeholders.length
  ? report('WARN', 'A1', `placeholder text: ${placeholders.join(', ')}`)
  : report('PASS', 'A1', 'no placeholder text found');

if (grep(apiFiles, /notion/i).length)
  report(
    'MANUAL',
    'A6/G9',
    'Notion sync shares expense data with a third party — disclose in policy, App Privacy, Data safety',
  );

// --- console-only items ----------------------------------------------------------
for (const [id, msg] of [
  ['A2/G12', 'reviewer demo account + TOTP instructions in App Review notes / Play "App access"'],
  ['A3', 'decide audience: public listing vs TestFlight/Unlisted (Apple) and closed testing (Play)'],
  ['A4/G6', 'privacy policy URL entered in App Store Connect and Play Console'],
  [
    'store',
    'App Privacy labels + Play Data safety form, age/content rating, screenshots, Financial features declaration',
  ],
]) {
  report('MANUAL', id, msg);
}

// --- output ------------------------------------------------------------------------
const order = { FAIL: 0, WARN: 1, MANUAL: 2, PASS: 3 };
results.sort((a, b) => order[a.level] - order[b.level]);
for (const r of results) console.log(`${r.level.padEnd(6)} ${r.id.padEnd(7)} ${r.msg}`);
const count = (l) => results.filter((r) => r.level === l).length;
console.log(`\n${count('FAIL')} fail, ${count('WARN')} warn, ${count('MANUAL')} manual, ${count('PASS')} pass`);
process.exit(count('FAIL') ? 1 : 0);
