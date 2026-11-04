import { createHash } from 'node:crypto';
import type { FastifyReply } from 'fastify';

const CSS = `
:root { color-scheme: light dark; --bg: #f6f5f2; --card: #fff; --text: #1d1d1b; --muted: #5f5f5a; --line: #d9d7d0;
  --accent: #1f6f5c; --on-accent: #fff; --error: #a4262c; }
@media (prefers-color-scheme: dark) {
  :root { --bg: #161615; --card: #22221f; --text: #f1f0ec; --muted: #aaa9a2; --line: #3b3a36;
    --accent: #5cc0a5; --on-accent: #10201b; --error: #ff8f8f; }
}
* { box-sizing: border-box; }
body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 16px;
  background: var(--bg); color: var(--text); font: 16px/1.5 system-ui, -apple-system, sans-serif; }
main { width: 100%; max-width: 380px; padding: 24px; background: var(--card); border: 1px solid var(--line);
  border-radius: 12px; }
h1 { margin: 0 0 12px; font-size: 22px; line-height: 1.3; }
p { margin: 0 0 16px; overflow-wrap: anywhere; }
.muted { color: var(--muted); }
.error { color: var(--error); font-weight: 600; }
a { color: var(--accent); font-weight: 600; }
label { display: block; margin-bottom: 4px; font-weight: 600; }
input[type='text'] { width: 100%; margin-bottom: 16px; padding: 10px 12px; font: inherit; color: inherit;
  background: transparent; border: 1px solid var(--line); border-radius: 8px; }
input[type='text']:focus { outline: 2px solid var(--accent); outline-offset: 1px; }
button { width: 100%; padding: 12px; font: inherit; font-weight: 600; cursor: pointer; color: var(--on-accent);
  background: var(--accent); border: 0; border-radius: 8px; }
`;

const CSS_HASH = createHash('sha256').update(CSS).digest('base64');

/**
 * Behind nginx these pages carry its CSP too, and browsers enforce both. So styles stay in the one hashed `<style>`
 * element, and never in a `style` attribute, which the hash doesn't cover.
 */
const CONTENT_SECURITY_POLICY =
  `default-src 'none'; style-src 'sha256-${CSS_HASH}'; form-action 'self'; frame-ancestors 'none'; ` +
  `base-uri 'none'`;

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Everything put into a page goes through here: a client picks its own name. */
function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => ESCAPES[char]!);
}

function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>${CSS}</style>
</head>
<body><main>${body}</main></body>
</html>
`;
}

export function sendPage(reply: FastifyReply, status: number, html: string): FastifyReply {
  return reply
    .code(status)
    .header('content-type', 'text/html; charset=utf-8')
    .header('content-security-policy', CONTENT_SECURITY_POLICY)
    .header('cache-control', 'no-store')
    .send(html);
}

export function errorPage(message: string): string {
  return page(
    'Kopiyka',
    `<h1>Kopiyka can’t continue</h1><p>${escapeHtml(message)}</p>
<p class="muted">Go back to the app you came from and connect again.</p>`,
  );
}

/** No automatic redirect: anyone can register a client, so the visitor chooses whether to go back to it. */
export function faultPage(redirectHost: string, returnUrl: string): string {
  const host = escapeHtml(redirectHost);
  return page(
    'Kopiyka',
    `<h1>Kopiyka can’t continue</h1><p>The app’s sign-in request isn’t valid, so nothing was shared with it.</p>
<p><a href="${escapeHtml(returnUrl)}" rel="noreferrer">Return to ${host}</a></p>`,
  );
}

export interface SignInView {
  clientName: string;
  redirectHost: string;
  /** The sealed authorization request. */
  request: string;
  username?: string;
  error?: string;
}

export function signInPage({ clientName, redirectHost, request, username, error }: SignInView): string {
  // A client picks its own name, so the page never states it as fact.
  const client = clientName ? `An app calling itself <bdi>${escapeHtml(clientName)}</bdi>` : 'An app';
  return page(
    'Sign in to Kopiyka',
    `<h1>Sign in to Kopiyka</h1>
<p>${client} wants to read your budgets. You’ll go back to <strong>${escapeHtml(redirectHost)}</strong> afterwards.</p>
${error ? `<p class="error" role="alert">${escapeHtml(error)}</p>` : ''}
<form method="post" action="/oauth/authorize">
<input type="hidden" name="request" value="${escapeHtml(request)}">
<label for="username">Username</label>
<input type="text" id="username" name="username" value="${escapeHtml(username ?? '')}" autocomplete="username"
  autocapitalize="none" spellcheck="false" maxlength="64" required>
<label for="code">6-digit code</label>
<input type="text" id="code" name="code" autocomplete="one-time-code" inputmode="numeric" pattern="[0-9]{6}"
  maxlength="6" required>
<button type="submit">Continue</button>
</form>`,
  );
}
