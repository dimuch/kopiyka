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
const noRawStyleNumber = {
  selector:
    'Property[key.name=/^(fontSize|lineHeight|letterSpacing|border[A-Za-z]*Radius|padding[A-Za-z]*|margin[A-Za-z]*|gap|rowGap|columnGap)$/] Literal[raw=/^[0-9.]/]',
  message:
    'Use space, radius, size or text from @/theme. Layout maths with no token: eslint-disable-next-line no-restricted-syntax, with the reason on the line above.',
};

// Files not moved onto tokens yet; briefs 103b and 103c empty this list.
const notOnTokensYet = [
  'src/app/category-form.tsx',
  'src/app/category/\\[categoryId\\].tsx',
  'src/app/delete-category.tsx',
  'src/app/expense.tsx',
  'src/app/income-item.tsx',
  'src/app/login.tsx',
  'src/app/members.tsx',
  'src/app/no-ledger.tsx',
  'src/components/AddExpenseButton.tsx',
  'src/components/AmountFields.tsx',
  'src/components/AppearancePicker.tsx',
  'src/components/CategoryForm.tsx',
  'src/components/CategoryPicker.tsx',
  'src/components/CategorySheet.tsx',
  'src/components/CategoryTile.tsx',
  'src/components/CollapsingSummary.tsx',
  'src/components/DateChips.tsx',
  'src/components/DateField.tsx',
  'src/components/EmptyMonth.tsx',
  'src/components/HomeButton.tsx',
  'src/components/HomeCards.tsx',
  'src/components/LedgerPicker.tsx',
  'src/components/LoadError.tsx',
  'src/components/MonthSwitcher.tsx',
  'src/components/NotionSyncPanel.tsx',
  'src/components/PendingInvites.tsx',
  'src/components/ReorderList.tsx',
  'src/components/TabBar.tsx',
  'src/components/UndoToast.tsx',
  'src/demo/DemoStrip.tsx',
];

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
