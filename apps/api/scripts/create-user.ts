// Admin-only: creates a user, their own ledger with the 15 default categories,
// and prints a QR code to scan with Google Authenticator. With --join, the user
// gets no ledger of their own and becomes a member of the one <owner> owns.
//
//   yarn api create-user --username ivanka --email ivanka@example.com [--ledger "Home" | --join dimuch]
//
// It needs the same TOTP_ENC_KEY as the API that will verify the codes, so for
// production run it on the droplet over ssh rather than copying the key out.
import { parseArgs } from 'node:util';
import QRCode from 'qrcode';
import { z } from 'zod';
import { createUserJoiningLedger, createUserWithLedger, type JoinError } from '../src/admin.js';
import { loadConfig } from '../src/config.js';
import { createDb } from '../src/db.js';

const { values } = parseArgs({
  options: {
    username: { type: 'string' },
    email: { type: 'string' },
    ledger: { type: 'string' },
    join: { type: 'string' },
  },
});

const Username = z
  .string()
  .trim()
  .regex(/^[a-zA-Z0-9_.-]{3,64}$/, '3–64 letters, digits, _ . -');

const input = z
  .object({
    username: Username,
    email: z.email().max(255),
    ledger: z.string().trim().min(1).max(100).optional(),
    join: Username.optional(),
  })
  .refine((v) => !(v.join !== undefined && v.ledger !== undefined), {
    error: 'use --ledger or --join, not both',
    path: ['join'],
  })
  .safeParse(values);

if (!input.success) {
  console.error('Usage: yarn api create-user --username <name> --email <email> [--ledger <name> | --join <owner>]');
  for (const issue of input.error.issues) console.error(`  ${issue.path.join('.')}: ${issue.message}`);
  process.exit(1);
}

const config = loadConfig();
const db = createDb(config.databaseUrl);
const { username, email, ledger, join } = input.data;
const JOIN_ERRORS: Record<JoinError, string> = {
  no_such_user: `No user "${join}" to join.`,
  owns_no_ledger: `"${join}" owns no ledger to join.`,
  owns_several_ledgers: `"${join}" owns more than one ledger; not guessing which one to join.`,
};

try {
  const user = join
    ? await createUserJoiningLedger(db, config.totpKey, { username, email, join })
    : await createUserWithLedger(db, config.totpKey, { username, email, ledgerName: ledger ?? 'Home' }, new Date());
  if ('error' in user) {
    console.error(JOIN_ERRORS[user.error]);
    process.exitCode = 1;
  } else {
    console.log(
      join
        ? `Created user #${user.userId} "${username}" as a member of ${join}'s ledger #${user.ledgerId}.`
        : `Created user #${user.userId} "${username}" with ledger #${user.ledgerId}.`,
    );
    console.log('Scan this in Google Authenticator (shown once, not stored anywhere readable):\n');
    console.log(await QRCode.toString(user.otpauthUri, { type: 'terminal', small: true }));
    console.log(`Or enter manually: ${new URL(user.otpauthUri).searchParams.get('secret')}`);
  }
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
