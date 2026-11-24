// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier/flat');

// Brief 095: the web build never shows accessibilityState to screen readers; the aria-* props reach both.
const noAccessibilityState = {
  selector: "JSXAttribute[name.name='accessibilityState']",
  message:
    'react-native-web ignores accessibilityState. Use aria-busy, aria-checked, aria-expanded or aria-selected; on a Pressable, use disabled (react-native-web drops aria-disabled there).',
};

// Brief 103: style numbers come from the tokens in src/theme.ts (docs/design/design-system.md).
const styleNumberKey =
  '/^(fontSize|lineHeight|letterSpacing|border[A-Za-z]*Radius|padding[A-Za-z]*|margin[A-Za-z]*|gap|rowGap|columnGap)$/';
const noRawStyleNumber = {
  // key.name for `gap: 3`, key.value for a quoted `'gap': 3`.
  selector: `Property:matches([key.name=${styleNumberKey}], [key.value=${styleNumberKey}]) Literal[raw=/^[0-9.]/]`,
  message:
    'Use space, radius, size or text from @/theme. Layout maths with no token: eslint-disable-next-line no-restricted-syntax, with the reason on the line above.',
};

// Files not moved onto tokens yet; brief 103d empties this list.
const notOnTokensYet = ['src/app/login.tsx', 'src/app/members.tsx', 'src/app/no-ledger.tsx'];

module.exports = defineConfig([
  expoConfig,
  // Prettier owns formatting (`yarn format`); ESLint only checks code.
  prettierConfig,
  {
    ignores: ['dist/*', '.expo/*'],
  },
  {
    rules: {
      'no-restricted-syntax': ['error', noAccessibilityState],
    },
  },
  {
    // A later config object replaces a rule's options, so this one repeats noAccessibilityState.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/theme.ts', ...notOnTokensYet],
    rules: {
      'no-restricted-syntax': ['error', noAccessibilityState, noRawStyleNumber],
    },
  },
]);
