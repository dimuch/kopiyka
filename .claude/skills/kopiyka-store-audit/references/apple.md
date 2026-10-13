# Apple App Store checklist (kopiyka)

⏱ = time-sensitive; verify on the official page before reporting.

Official sources:

- Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
- Upcoming requirements (SDK/Xcode minimums): https://developer.apple.com/news/upcoming-requirements/
- Required-reason APIs / privacy manifest: https://developer.apple.com/documentation/bundleresources/privacy-manifest-files/describing-use-of-required-reason-api
- App Privacy details: https://developer.apple.com/app-store/app-privacy-details/
- Unlisted distribution: https://developer.apple.com/support/unlisted-app-distribution/

## Code / config checks

| Id  | Rule                      | What to check in kopiyka                                                                                                                                                                                                                                                             |
| --- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A1  | 2.1 App completeness      | No placeholder/"coming soon" screens, no dead buttons, no crash on cold start, no dev-only UI in a release build. Backend reachable over HTTPS from a release build (`EXPO_PUBLIC_API_URL`, `apps/mobile/src/api/client.ts`).                                                        |
| A2  | 2.1 Demo account          | Login-only app → App Review needs working credentials (incl. how to pass TOTP) in review notes. Check there's a way to give reviewers a stable account with sample data.                                                                                                             |
| A3  | 4.2 / 3.2 Audience        | If the app is only for one household, a public listing risks rejection as not for the general public. Options: TestFlight, Unlisted distribution, or make sign-up/ledgers usable by anyone. Flag as a decision for the user.                                                         |
| A4  | 5.1.1(i) Privacy policy   | A privacy policy URL is required in App Store Connect **and** must be reachable inside the app (e.g. settings/login screen). Grep `apps/mobile/src` for a link.                                                                                                                      |
| A5  | 5.1.1(v) Account deletion | Required if the app supports account creation. Kopiyka: accounts are admin-created → confirm still true (`apps/api/src/admin.ts`, no register route). If sign-up is ever added, in-app deletion becomes a FAIL.                                                                      |
| A6  | 5.1.2 Data use            | Notion sync sends expense data to a third party → disclose in privacy policy and App Privacy labels.                                                                                                                                                                                 |
| A7  | Privacy manifest ⏱        | Apps using required-reason APIs must declare them. AsyncStorage → `NSUserDefaults` (reason `CA92.1`); file timestamp/disk space/boot time APIs are often pulled in by RN/Expo. Expect `expo.ios.privacyManifests` in `app.json`; missing → WARN (Apple emails ITMS-91053 on upload). |
| A8  | Export compliance         | HTTPS-only apps are exempt; set `expo.ios.config.usesNonExemptEncryption: false` so each build isn't blocked on the question.                                                                                                                                                        |
| A9  | ATS / networking          | No plain `http://` endpoints in release builds (localhost fallback must not ship).                                                                                                                                                                                                   |
| A10 | Permissions               | Every permission-using module needs an `NS*UsageDescription` with a specific purpose string. Today kopiyka uses none — re-check deps (camera, photos, location, notifications, Face ID via secure-store `requireAuthentication`).                                                    |
| A11 | 4.8 Sign in with Apple    | Only required with third-party/social login. Kopiyka's own login → PASS while that's true.                                                                                                                                                                                           |
| A12 | Icon                      | `icon.png` 1024×1024, no alpha channel.                                                                                                                                                                                                                                              |
| A13 | Build SDK ⏱               | Uploads must be built with the Xcode/iOS SDK Apple currently mandates; check Expo SDK + EAS image meet it.                                                                                                                                                                           |
| A14 | Versioning                | `expo.version` (marketing) and `ios.buildNumber` (or EAS `autoIncrement`) increase per upload.                                                                                                                                                                                       |
| A15 | 2.5.2 / web               | No downloading/executing code that changes app features (OTA updates of JS bug fixes are fine; feature-changing OTA isn't).                                                                                                                                                          |

## App Store Connect (MANUAL)

- App Privacy questionnaire: derive from the API — username, financial
  info (expenses, amounts, categories), device/IP in login-attempt
  rows (`apps/api/src/auth`), any data shared with Notion. Linked to the
  user; not used for tracking (unless that changes).
- Age rating questionnaire; category Finance.
- Screenshots for required iPhone display sizes; no iPad if
  `supportsTablet: false`.
- Review notes: demo credentials + TOTP instructions, what Notion sync is.
- Support URL, privacy policy URL, copyright, contact info.
