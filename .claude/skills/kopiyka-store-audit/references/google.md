# Google Play checklist (kopiyka)

⏱ = time-sensitive; verify on the official page before reporting.

Official sources:

- Developer Program Policy: https://play.google.com/about/developer-content-policy/
- Target API level requirements: https://support.google.com/googleplay/android-developer/answer/11926878
- Data safety section: https://support.google.com/googleplay/android-developer/answer/10787469
- Account deletion requirements: https://support.google.com/googleplay/android-developer/answer/13327111
- Testing requirements for new personal developer accounts: https://support.google.com/googleplay/android-developer/answer/14151465

## Code / config checks

| Id  | Rule                          | What to check in kopiyka                                                                                                                                                                                                        |
| --- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G1  | Package name                  | `expo.android.package` must be set (permanent once published). Missing → FAIL.                                                                                                                                                  |
| G2  | Versioning                    | `android.versionCode` (or EAS `autoIncrement`) increases per upload.                                                                                                                                                            |
| G3  | Target API ⏱                  | New apps/updates must target the API level Play currently requires. Check the targetSdk that Expo SDK in `apps/mobile/package.json` ships with.                                                                                 |
| G4  | 16 KB page size ⏱             | Apps targeting Android 15+ must support 16 KB pages; React Native ≥ 0.77 does.                                                                                                                                                  |
| G5  | Permissions                   | Only needed permissions. Review `android.permissions` / `android.blockedPermissions`; consider blocking defaults you don't use. Sensitive ones (SMS, call log, all-files, exact alarms, background location) need declarations. |
| G6  | Privacy policy                | Required in Play Console and must be reachable in-app for apps handling personal/financial data.                                                                                                                                |
| G7  | Account deletion              | Required (in-app + web link) only if the app lets users create accounts. Kopiyka: admin-created → confirm; data-deletion answers in Data safety still apply.                                                                    |
| G8  | Financial features ⏱          | Every app completes the Financial features declaration. Kopiyka is a personal budget tracker (no loans, payments, crypto) — declare accurately.                                                                                 |
| G9  | User data                     | Financial data sent to the API and Notion must be encrypted in transit (HTTPS only) and disclosed in Data safety.                                                                                                               |
| G10 | Network                       | No cleartext `http://` in release; Android blocks cleartext by default from API 28.                                                                                                                                             |
| G11 | Icons                         | Adaptive icon foreground/background/monochrome present; 512×512 store icon uploaded in console.                                                                                                                                 |
| G12 | Minimum functionality / login | App access: provide reviewer credentials + TOTP instructions in "App access".                                                                                                                                                   |

## Play Console (MANUAL)

- New **personal** developer accounts must run a closed test with a
  minimum number of opted-in testers for a minimum number of days before
  production access ⏱ (check current numbers). For a household-only app,
  closed/internal testing may be the final distribution anyway.
- Data safety form (same inventory as Apple App Privacy).
- Content rating (IARC questionnaire), target audience (not children),
  ads declaration (no ads), government/health/news declarations (none).
- Store listing: short + full description, 512 icon, feature graphic
  1024×500, phone screenshots.
- Build as AAB with Play App Signing (EAS `production` profile).
