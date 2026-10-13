import { z } from 'zod';

const bool = z.enum(['true', 'false']).transform((v) => v === 'true');

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().default(4000),
    CORS_ORIGINS: z.string().default(''),
    TRUST_PROXY: bool.default('false'),
    DATABASE_URL: z.string().url(),
    JWT_ACCESS_SECRET: z.string().min(32),
    TOKEN_HASH_PEPPER: z.string().min(32),
    ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
    REFRESH_TOKEN_TTL_DAYS_MOBILE: z.coerce.number().int().min(1).max(365).default(60),
    REFRESH_TOKEN_TTL_HOURS_ADMIN: z.coerce.number().int().min(1).max(72).default(12),
    STORAGE_DRIVER: z.enum(['s3', 'local']).default('s3'),
    S3_ENDPOINT: z.string().optional(),
    S3_REGION: z.string().default('us-east-1'),
    S3_BUCKET: z.string().default('dar-private'),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
    S3_FORCE_PATH_STYLE: bool.default('true'),
    PUBLIC_API_URL: z.string().url().default('http://localhost:4000'),
    SIGNED_URL_TTL_SECONDS: z.coerce.number().int().min(60).max(86400).default(900),
    PUSH_ENABLED: bool.default('false'),
    EXPO_ACCESS_TOKEN: z.string().optional(),
    EMAIL_DRIVER: z.enum(['console', 'smtp', 'none']).default('console'),
    EMAIL_FROM: z.string().default('Dar <no-reply@example.com>'),
    SMTP_URL: z.string().optional(),
    ADMIN_WEB_URL: z.string().url().default('http://localhost:3000'),
    APP_DEEP_LINK_SCHEME: z.string().default('dar'),
    OTP_PROVIDER: z.enum(['none']).default('none'),
    OCR_PROVIDER: z.enum(['none']).default('none'),
    JOBS_ENABLED: bool.default('true'),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production') {
      if (env.STORAGE_DRIVER === 'local') ctx.addIssue({ code: 'custom', path: ['STORAGE_DRIVER'], message: 'local storage is development-only' });
      if (env.EMAIL_DRIVER === 'console') ctx.addIssue({ code: 'custom', path: ['EMAIL_DRIVER'], message: 'console email would print reset links to logs' });
      if (/change-me/.test(env.JWT_ACCESS_SECRET) || /change-me/.test(env.TOKEN_HASH_PEPPER)) {
        ctx.addIssue({ code: 'custom', path: ['JWT_ACCESS_SECRET'], message: 'placeholder secrets are not allowed in production' });
      }
      if (!env.CORS_ORIGINS) ctx.addIssue({ code: 'custom', path: ['CORS_ORIGINS'], message: 'set the admin dashboard origin' });
    }
    if (env.STORAGE_DRIVER === 's3' && (!env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY)) {
      ctx.addIssue({ code: 'custom', path: ['S3_ACCESS_KEY_ID'], message: 'S3 credentials are required for the s3 storage driver' });
    }
  });

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;
export function env(): Env {
  if (!cached) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      // Print variable names and problems only — never values.
      const problems = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n  ');
      throw new Error(`Invalid environment configuration:\n  ${problems}`);
    }
    cached = parsed.data;
  }
  return cached;
}
