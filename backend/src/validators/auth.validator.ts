import { z } from "zod";

export const strongPasswordMessage = "Password must contain uppercase, lowercase, number, and special character.";
export const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;

export const strongPasswordSchema = z.string().regex(strongPasswordRegex, strongPasswordMessage);

export const signupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Valid email is required").toLowerCase(),
  password: strongPasswordSchema,
  role: z.enum(["USER", "OWNER", "ADMIN"]).default("USER")
});

export const loginSchema = z.object({
  email: z.string().email("Valid email is required").toLowerCase(),
  password: z.string().min(1, "Password is required"),
  expectedRole: z.enum(["USER", "OWNER", "ADMIN"], {
    message: "Login type is required"
  })
});

export const resetPasswordSchema = z.object({
  newPassword: strongPasswordSchema
});

export const adminCreateUserSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().email("Valid email is required").toLowerCase(),
  password: strongPasswordSchema,
  role: z.enum(["USER", "OWNER", "ADMIN"])
});
