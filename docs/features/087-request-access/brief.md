# Ask for access from the login page

Type: feature

## Why

A visitor who has tried the demo ("Try it now", brief 081) has no way to get a real account: there is no sign-up, and
accounts are created by hand. They need a way to ask for one, and to know what it would cost.

## What

On the login page on the web, below "Try it now", with some space between them:

- A text link **"Request access"**. It opens the visitor's mail app with a new message to `dmytro.kostylov@gmail.com`,
  with the subject `Kopiyka access request` filled in.
- Below it, a line of muted text: **"Full access: €5 a month"**. It's information only: nothing is sold or paid in the
  app, and the price isn't connected to anything.

Both look like the existing "Try it now" link and the page's muted text, in the app's theme. Nothing else on the page
changes. The iPhone and Android apps don't show either: their login page stays as it is, so the store builds stay clear of
the stores' payment rules.

## Acceptance criteria

- [ ] Given the login page, then "Request access" sits below "Try it now" with visibly more space than between Sign in
      and "Try it now", and "Full access: €5 a month" sits directly below it.
- [ ] Given a tap on "Request access", then the mail app opens a new message to `dmytro.kostylov@gmail.com` with the
      subject `Kopiyka access request`.
- [ ] Given a screen reader, then "Request access" reads as a link, and the price line reads as text.
- [ ] Given the link, then its touch target is at least 44 × 44.
- [ ] Given the iPhone or Android app, then the login page shows neither the link nor the price.
- [ ] Given the demo, then nothing changes: it has no login page, and its module list stays the same.

## Out of scope

- Sign-up, payment, or any account created automatically.
- Changing the price later from the API: it's fixed text for now.
- A form or a contact page.

## Notes

- `mailto:` with a subject: `mailto:dmytro.kostylov@gmail.com?subject=Kopiyka%20access%20request`. On web it opens the
  default mail app; on iOS, Mail.
- The address becomes public on the login page, so it may draw some spam.
- Web only (decided 2026-11-13): Apple (3.1.1, 3.1.3) and Google Play don't allow pointing to a way to pay for in-app
  features outside their own billing, and a price next to a contact link can read as that.
