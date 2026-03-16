import { AccountType } from '@prisma/client';
import { z } from 'zod';

const emailSchema = z.string().trim().email().max(255).transform((value) => value.toLowerCase());
const strongPasswordSchema = z
    .string()
    .min(8)
    .max(128)
    .regex(/[A-Z]/, 'Password must include at least one uppercase letter.')
    .regex(/[a-z]/, 'Password must include at least one lowercase letter.')
    .regex(/[0-9]/, 'Password must include at least one number.')
    .regex(/[^A-Za-z0-9]/, 'Password must include at least one symbol.');

const phoneSchema = z
    .string()
    .trim()
    .min(8)
    .max(25)
    .transform((value) => value.replace(/[\s\-()]/g, ''))
    .refine((value) => /^\+?[1-9]\d{7,14}$/.test(value), 'Phone must be a valid international number.')
    .transform((value) => (value.startsWith('+') ? value : `+${value}`));

const otpCodeSchema = z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'OTP code must be 6 digits.');

export const registerBodySchema = z.object({
    email: emailSchema,
    password: strongPasswordSchema,
    fullName: z.string().trim().min(2).max(100),
    accountType: z.nativeEnum(AccountType).optional(),
});

export const verifyEmailQuerySchema = z.object({
    token: z.string().trim().min(20).max(256),
});

export const loginBodySchema = z.object({
    email: emailSchema,
    password: z.string().min(8).max(128),
});

export const resendVerificationBodySchema = z.object({
    email: emailSchema,
});

export const forgotPasswordBodySchema = z.object({
    email: emailSchema,
});

export const resetPasswordBodySchema = z.object({
    token: z.string().trim().min(20).max(256),
    newPassword: strongPasswordSchema,
});

export const changePasswordBodySchema = z.object({
    currentPassword: z.string().min(8).max(128),
    newPassword: strongPasswordSchema,
});

export const requestPhoneVerificationBodySchema = z.object({
    phone: phoneSchema,
});

export const verifyPhoneOtpBodySchema = z.object({
    phone: phoneSchema,
    code: otpCodeSchema,
});

export const googleOAuthBodySchema = z.object({
    idToken: z.string().trim().min(10).max(4096).optional(),
    email: emailSchema.optional(),
    fullName: z.string().trim().min(2).max(100).optional(),
    providerUserId: z.string().trim().min(2).max(255).optional(),
});

export const facebookOAuthBodySchema = z.object({
    accessToken: z.string().trim().min(10).max(4096).optional(),
    email: emailSchema.optional(),
    fullName: z.string().trim().min(2).max(100).optional(),
    providerUserId: z.string().trim().min(2).max(255).optional(),
});

export type RegisterBody = z.infer<typeof registerBodySchema>;
export type VerifyEmailQuery = z.infer<typeof verifyEmailQuerySchema>;
export type LoginBody = z.infer<typeof loginBodySchema>;
export type ResendVerificationBody = z.infer<typeof resendVerificationBodySchema>;
export type ForgotPasswordBody = z.infer<typeof forgotPasswordBodySchema>;
export type ResetPasswordBody = z.infer<typeof resetPasswordBodySchema>;
export type ChangePasswordBody = z.infer<typeof changePasswordBodySchema>;
export type RequestPhoneVerificationBody = z.infer<typeof requestPhoneVerificationBodySchema>;
export type VerifyPhoneOtpBody = z.infer<typeof verifyPhoneOtpBodySchema>;
export type GoogleOAuthBody = z.infer<typeof googleOAuthBodySchema>;
export type FacebookOAuthBody = z.infer<typeof facebookOAuthBodySchema>;
