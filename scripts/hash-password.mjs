#!/usr/bin/env node
/**
 * Creates an operator login entry for CRM_OPERATORS.
 *
 *   npm run hash-password -- coach@theirdomain.com
 *
 * Prompts for the password (input hidden), then prints the env lines to paste
 * into your hosting provider (or .env.local). Format must match
 * src/lib/auth/password.ts.
 */
import crypto from 'node:crypto';
import readline from 'node:readline';

const email = (process.argv[2] || '').trim().toLowerCase();
if (!email.includes('@')) {
  console.error('Usage: npm run hash-password -- you@example.com');
  process.exit(1);
}

function readPasswordHidden(prompt) {
  return new Promise((resolve) => {
    if (!process.stdin.isTTY) {
      // Piped input (CI / scripts): read the first line.
      const rl = readline.createInterface({ input: process.stdin });
      rl.once('line', (line) => {
        rl.close();
        resolve(line);
      });
      return;
    }
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (str) => {
      if (str.includes(prompt)) rl.output.write(str);
    };
    rl.question(prompt, (answer) => {
      rl.output.write('\n');
      rl.close();
      resolve(answer);
    });
  });
}

const password = await readPasswordHidden('Password (min 12 characters): ');
if (password.length < 12) {
  console.error('Password must be at least 12 characters.');
  process.exit(1);
}

const salt = crypto.randomBytes(16);
const key = crypto.scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
const entry = `${email}=scrypt.${salt.toString('base64url')}.${key.toString('base64url')}`;

console.log('\nAdd to your environment (separate multiple operators with commas):\n');
console.log(`CRM_OPERATORS=${entry}`);
if (process.argv.includes('--with-secret')) {
  console.log(`SESSION_SECRET=${crypto.randomBytes(32).toString('base64url')}`);
}
console.log('');
