import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().default(5000),
  JWT_SECRET: z.string().min(16),
  FRONTEND_URL: z.string().url().default("http://localhost:3000"),
  EMAIL_USER: z.string().email().default("dev@example.com"),
  EMAIL_PASS: z.string().min(1).default("dev-email-password"),
  RAZORPAY_KEY_ID: z.string().min(1).default("rzp_test_dev_key"),
  RAZORPAY_KEY_SECRET: z.string().min(1).default("rzp_test_dev_secret"),
  RAZORPAY_WEBHOOK_SECRET: z.string().min(1).default("dev_webhook_secret"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  JWT_EXPIRES_IN: z.string().default("7d")
});

export const env = envSchema.parse(process.env);
