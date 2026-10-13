// Loads apps/api/.env in development using Node's built-in loader (Node ≥ 21.7).
// In production, inject environment variables through your platform instead.
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const file = join(process.cwd(), '.env');
if (existsSync(file) && process.env.NODE_ENV !== 'production') {
  process.loadEnvFile(file);
}
