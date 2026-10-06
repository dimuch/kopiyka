// Admin-only: creates a user, their own ledger with the 15 default categories,
// and prints a QR code to scan with Google Authenticator.
//
//   yarn api create-user --username ivanka --email ivanka@example.com [--ledger "Home"]
//
// It needs the same TOTP_ENC_KEY as the API that will verify the codes, so for
// production run it on the droplet over ssh rather than copying the key out.
import { parseArgs } from 'node:util';
import QRCode from 'qrcode';
import { z } from 'zod';
import { createUserWithLedger } from '../src/admin.js';
import { loadConfig } from '../src/config.js';
import { createDb } from '../src/db.js';

const { values } = parseArgs({
  options: {
    username: { type: 'string' },
    email: { type: 'string' },
    ledger: { type: 'string', default: 'Home' },
  },
});

const input = z
  .object({
    username: z.string().trim().regex(/^[a-zA-Z0-9_.-]{3,64}$/, '3–64 letters, digits, _ . -'),
    email: z.email().max(255),
    ledger: z.string().trim().min(1).max(100),
  })
  .safeParse(values);

if (!input.success) {
  console.error('Usage: yarn api create-user --username <name> --email <email> [--ledger <name>]');
  for (const issue of input.error.issues) console.error(`  ${issue.path.join('.')}: ${issue.message}`);
  process.exit(1);
}

const config = loadConfig();
const db = createDb(config.databaseUrl);
try {
  const user = await createUserWithLedger(db, config.totpKey, {
    username: input.data.username,
    email: input.data.email,
    ledgerName: input.data.ledger,
  });
  console.log(`Created user #${user.userId} "${input.data.username}" with ledger #${user.ledgerId}.`);
  console.log('Scan this in Google Authenticator (shown once, not stored anywhere readable):\n');
  console.log(await QRCode.toString(user.otpauthUri, { type: 'terminal', small: true }));
  console.log(`Or enter manually: ${new URL(user.otpauthUri).searchParams.get('secret')}`);
} catch (err) {
  if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
    console.error('A user with that username or email already exists.');
    process.exitCode = 1;
  } else {
    throw err;
  }
} finally {
  await db.end();
}
