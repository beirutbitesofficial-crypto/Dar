import { execSync } from 'node:child_process';

/** Resets the test database and loads base reference data (no demo data). */
export default async function globalSetup() {
  const url = process.env.TEST_DATABASE_URL ?? 'postgresql://dar:dar_local_dev@localhost:5432/dar_test';
  if (!/test/.test(url)) throw new Error('Refusing to reset a database whose name does not contain "test"');
  const env = { ...process.env, DATABASE_URL: url, SEED_DEMO: 'false', NODE_ENV: 'test' };
  execSync('npx prisma migrate reset --force --skip-generate --skip-seed', { stdio: 'inherit', env });
  execSync('npx tsx prisma/seed.ts', { stdio: 'inherit', env });
}
