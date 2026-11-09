import { z } from "zod/v4";

/**
 * Environment variable schema.
 *
 * Variables needed for basic server startup are required.
 * Variables for external services are optional until their
 * respective milestones, then we tighten the schema.
 */
const envSchema = z.object({
  // Server
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),

  // Database
  DATABASE_URL: z.string().url().optional(),

  // Authentication
  JWT_SECRET: z.string().min(16).optional(),

  // Google Gemini
  GEMINI_API_KEY: z.string().min(1).optional(),
  GEMINI_MODEL: z.string().default("gemini-2.0-flash"),

  // PayPal
  PAYPAL_BASE_URL: z
    .string()
    .url()
    .default("https://api-m.sandbox.paypal.com"),
  PAYPAL_CLIENT_ID: z.string().min(1).optional(),
  PAYPAL_CLIENT_SECRET: z.string().min(1).optional(),
  PAYPAL_WEBHOOK_ID: z.string().min(1).optional(),
  PAYPAL_CURRENCY: z.string().length(3).default("USD"),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Parse and validate environment variables.
 * Throws with clear error messages if validation fails.
 */
function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error("❌ Invalid environment variables:");
    console.error(JSON.stringify(result.error.format(), null, 2));
    process.exit(1);
  }

  return result.data;
}

/** Validated environment variables — import this everywhere. */
export const env = loadEnv();

