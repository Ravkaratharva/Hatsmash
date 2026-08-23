import { z } from "zod";

export const authModeSchema = z.enum(["login", "signup"]);

export const emailSchema = z
  .string()
  .trim()
  .min(3)
  .max(254)
  .email()
  .transform((value) => value.toLowerCase());

export const otpSchema = z.string().trim().regex(/^\d{6}$/);

export const requestOtpSchema = z.object({
  email: emailSchema,
  mode: authModeSchema,
  returnTo: z.unknown().optional(),
  captchaToken: z.string().trim().min(1).max(2048),
});

export const verifyOtpSchema = z.object({
  email: emailSchema,
  token: otpSchema,
  returnTo: z.unknown().optional(),
});
