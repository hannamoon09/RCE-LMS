import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const content = [
  'DB_NAME=rce_lms',
  'DB_PORT=5432',
  'DB_URL=jdbc:postgresql://localhost:5432/rce_lms',
  'DB_USERNAME=rce_lms',
  `DB_PASSWORD=${randomBytes(32).toString('hex')}`,
  'SPRING_PROFILES_ACTIVE=dev',
  `DEV_SEED_PASSWORD=${randomBytes(24).toString('base64url')}`,
  'FILE_STORAGE_PATH=../backend-data/uploads',
  'SESSION_COOKIE_SECURE=false',
  'PORT=8080',
  'SERVER_ADDRESS=127.0.0.1',
  '',
].join('\n');
try {
  await writeFile(path.join(root, '.env'), content, { flag: 'wx', mode: 0o600 });
  console.log('Created local .env with random development secrets and owner-only permissions. Values were not printed.');
} catch (error) {
  if (error.code !== 'EEXIST') throw error;
  console.log('Existing .env preserved.');
}
