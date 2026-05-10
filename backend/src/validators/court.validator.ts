import { z } from "zod";

export const mobileValidationMessage = "Please enter a valid mobile number.";

export function normalizeIndianMobile(value: unknown) {
  const compact = String(value ?? "").replace(/\s+/g, "");
  const match = compact.match(/^(\+91)?([6-9]\d{9})$/);
  if (!match) {
    throw new Error(mobileValidationMessage);
  }
  return match[2];
}

const contactMobileSchema = z
  .unknown()
  .transform((value, ctx) => {
    try {
      return normalizeIndianMobile(value);
    } catch {
      ctx.addIssue({ code: "custom", message: mobileValidationMessage });
      return z.NEVER;
    }
  });

export const createCourtSchema = z.object({
  name: z.string().min(2),
  description: z.string().min(10),
  city: z.string().min(2),
  area: z.string().min(2),
  address: z.string().min(5),
  contactMobile: contactMobileSchema,
  pricePerHour: z.coerce.number().positive(),
  rating: z.coerce.number().min(0).max(5).optional(),
  status: z.enum(["PENDING_APPROVAL", "ACTIVE", "INACTIVE", "MAINTENANCE", "REJECTED"]).optional()
});

export const updateCourtSchema = createCourtSchema.partial().extend({
  contactMobile: contactMobileSchema
});

export const courtStatusSchema = z.object({
  status: z.enum(["PENDING_APPROVAL", "ACTIVE", "INACTIVE", "MAINTENANCE", "REJECTED"])
});

export const courtQuerySchema = z.object({
  city: z.string().optional(),
  area: z.string().optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  status: z.enum(["PENDING_APPROVAL", "ACTIVE", "INACTIVE", "MAINTENANCE", "REJECTED"]).optional()
});
