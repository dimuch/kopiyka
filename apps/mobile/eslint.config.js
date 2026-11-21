// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier/flat');

module.exports = defineConfig([
  expoConfig,
  // Prettier owns formatting (`yarn format`); ESLint only checks code.
  prettierConfig,
  {
    ignores: ['dist/*', '.expo/*'],
  },
  {
    rules: {
      // Brief 095: the web build never shows accessibilityState to screen readers; the aria-* props reach both.
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXAttribute[name.name='accessibilityState']",
          message:
            'react-native-web ignores accessibilityState. Use aria-busy, aria-checked, aria-expanded or aria-selected; on a Pressable, use disabled (react-native-web drops aria-disabled there).',
        },
      ],
    },
  },
]);
