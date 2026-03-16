import { randomBytes } from 'crypto';
import { Prisma, type AccountType, type IdentityVerificationStatus, type Role, type StaffRole, type TrustTier } from '@prisma/client';
import { ApiError } from '../../shared/middleware/errorHandler.js';
import { comparePassword, hashPassword } from '../../shared/utils/bcrypt.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../shared/utils/jwt.js';
import { generateOTP, verifyOTP } from '../../shared/utils/otp.js';
import { prisma } from '../../shared/utils/prisma.js';
import { redis } from '../../shared/utils/redis.js';
import { sendWhatsAppOTP } from '../../shared/utils/whatsapp.js';
import { resetPasswordEmailHtml, sendEmail, verificationEmailHtml } from '../../shared/utils/email.js';
import type {
    ChangePasswordBody,
    FacebookOAuthBody,
    ForgotPasswordBody,
    GoogleOAuthBody,
    LoginBody,
    RequestPhoneVerificationBody,
    RegisterBody,
    ResendVerificationBody,
    ResetPasswordBody,
    VerifyPhoneOtpBody,
} from './auth.validation.js';

const EMAIL_VERIFICATION_TTL_SECONDS = 60 * 60;
const EMAIL_VERIFY_TOKEN_PREFIX = 'email_verify';
const PASSWORD_RESET_TTL_SECONDS = 60 * 60;
const PASSWORD_RESET_TOKEN_PREFIX = 'password_reset';
const PHONE_VERIFICATION_TTL_SECONDS = 10 * 60;
const PHONE_VERIFICATION_PENDING_PREFIX = 'phone_verify_pending';
const OAUTH_PROFILE_TIMEOUT_MS = 8000;

function buildEmailVerificationKey(token: string): string {
    return `${EMAIL_VERIFY_TOKEN_PREFIX}:${token}`;
}

function buildPasswordResetKey(token: string): string {
    return `${PASSWORD_RESET_TOKEN_PREFIX}:${token}`;
}

function buildPendingPhoneVerificationKey(userId: number): string {
    return `${PHONE_VERIFICATION_PENDING_PREFIX}:${userId}`;
}

function createEmailVerificationToken(): string {
    return randomBytes(32).toString('hex');
}

export interface RegisterResult {
    userId: number;
    email: string;
    emailVerificationRequired: boolean;
}

export interface LoginResult {
    accessToken: string;
    refreshToken: string;
    tokenType: 'Bearer';
    user: {
        id: number;
        email: string;
    };
}

export interface RefreshAccessTokenResult {
    accessToken: string;
    tokenType: 'Bearer';
}

export interface ResendVerificationResult {
    requested: true;
}

export interface ForgotPasswordResult {
    requested: true;
}

export interface ResetPasswordResult {
    reset: true;
}

export interface ChangePasswordResult {
    changed: true;
}

export interface RequestPhoneVerificationResult {
    requested: true;
    channel: 'WHATSAPP';
    expiresInSeconds: number;
}

export interface VerifyPhoneOtpResult {
    verified: true;
    phone: string;
}

interface OAuthProfile {
    providerUserId: string;
    email: string;
    fullName: string;
}

type OAuthProvider = 'GOOGLE' | 'FACEBOOK';

interface LoginSessionUser {
    id: number;
    email: string | null;
    role: Role;
    accountType: AccountType;
    staffRole: StaffRole;
    trustTier: TrustTier;
}

interface OAuthAuthUser extends LoginSessionUser {
    isActive: boolean;
    bannedAt: Date | null;
    emailVerifiedAt: Date | null;
    googleId: string | null;
    facebookId: string | null;
}

export interface CurrentUserResult {
    id: number;
    email: string | null;
    phone: string | null;
    role: Role;
    accountType: AccountType;
    staffRole: StaffRole;
    trustTier: TrustTier;
    isActive: boolean;
    emailVerified: boolean;
    phoneVerified: boolean;
    identityVerificationStatus: IdentityVerificationStatus;
    identityVerifiedAt: string | null;
    fullName: string | null;
    countryId: number | null;
    cityId: number | null;
}

function createLoginResult(user: LoginSessionUser, fallbackEmail: string): LoginResult {
    const accessToken = signAccessToken({
        userId: user.id,
        role: user.role,
        accountType: user.accountType,
        staffRole: user.staffRole,
        trustTier: user.trustTier,
    });

    const refreshToken = signRefreshToken({
        userId: user.id,
        version: 1,
    });

    return {
        accessToken,
        refreshToken,
        tokenType: 'Bearer',
        user: {
            id: user.id,
            email: user.email ?? fallbackEmail,
        },
    };
}

async function sendVerificationEmail(userId: number, email: string, fullName: string): Promise<void> {
    const token = createEmailVerificationToken();
    const redisKey = buildEmailVerificationKey(token);
    await redis.setex(redisKey, EMAIL_VERIFICATION_TTL_SECONDS, String(userId));

    const emailSent = await sendEmail({
        to: email,
        subject: 'Verify your Souqly account',
        html: verificationEmailHtml(fullName, token),
    });

    if (!emailSent) {
        throw new ApiError(503, 'EMAIL_DELIVERY_FAILED', 'Could not send verification email.');
    }
}

function assertActiveUser(user: { isActive: boolean; bannedAt: Date | null }): void {
    if (!user.isActive || user.bannedAt) {
        throw new ApiError(403, 'ACCOUNT_DISABLED', 'Account is disabled.');
    }
}

function isOAuthMockMode(): boolean {
    const raw = process.env.OAUTH_MOCK_MODE;
    if (raw === undefined) return process.env.NODE_ENV !== 'production';
    return raw === 'true';
}

function normalizeOAuthName(fullName: string | undefined, email: string): string {
    const trimmed = fullName?.trim();
    if (trimmed && trimmed.length >= 2) return trimmed;
    return email.split('@')[0] || 'Souqly User';
}

async function fetchJsonWithTimeout(url: string): Promise<Record<string, unknown>> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), OAUTH_PROFILE_TIMEOUT_MS);

    try {
        const response = await fetch(url, {
            method: 'GET',
            signal: controller.signal,
        });

        if (!response.ok) {
            throw new ApiError(401, 'INVALID_OAUTH_TOKEN', 'OAuth token is invalid.');
        }

        const body = await response.json();
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
            throw new ApiError(502, 'OAUTH_PROVIDER_INVALID_RESPONSE', 'OAuth provider response is invalid.');
        }

        return body as Record<string, unknown>;
    } catch (error) {
        if (error instanceof ApiError) {
            throw error;
        }
        throw new ApiError(502, 'OAUTH_PROVIDER_UNAVAILABLE', 'OAuth provider is unavailable.');
    } finally {
        clearTimeout(timeoutId);
    }
}

async function resolveGoogleOAuthProfile(payload: GoogleOAuthBody): Promise<OAuthProfile> {
    if (isOAuthMockMode()) {
        if (!payload.email) {
            throw new ApiError(400, 'OAUTH_EMAIL_REQUIRED', 'Email is required in OAuth mock mode.');
        }

        const email = payload.email;
        const providerUserId = payload.providerUserId ?? `google:${email}`;
        return {
            providerUserId,
            email,
            fullName: normalizeOAuthName(payload.fullName, email),
        };
    }

    if (!payload.idToken) {
        throw new ApiError(400, 'OAUTH_TOKEN_REQUIRED', 'Google idToken is required.');
    }

    const tokenInfo = await fetchJsonWithTimeout(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(payload.idToken)}`,
    );

    const providerUserId =
        typeof tokenInfo.sub === 'string' && tokenInfo.sub.trim().length > 0
            ? tokenInfo.sub.trim()
            : null;
    const email =
        typeof tokenInfo.email === 'string' && tokenInfo.email.trim().length > 0
            ? tokenInfo.email.trim().toLowerCase()
            : null;
    const fullName =
        typeof tokenInfo.name === 'string' && tokenInfo.name.trim().length > 0
            ? tokenInfo.name.trim()
            : null;

    if (!providerUserId || !email) {
        throw new ApiError(400, 'OAUTH_PROFILE_INVALID', 'Google profile is missing required fields.');
    }

    return {
        providerUserId,
        email,
        fullName: normalizeOAuthName(fullName ?? undefined, email),
    };
}

async function resolveFacebookOAuthProfile(payload: FacebookOAuthBody): Promise<OAuthProfile> {
    if (isOAuthMockMode()) {
        if (!payload.email) {
            throw new ApiError(400, 'OAUTH_EMAIL_REQUIRED', 'Email is required in OAuth mock mode.');
        }

        const email = payload.email;
        const providerUserId = payload.providerUserId ?? `facebook:${email}`;
        return {
            providerUserId,
            email,
            fullName: normalizeOAuthName(payload.fullName, email),
        };
    }

    if (!payload.accessToken) {
        throw new ApiError(400, 'OAUTH_TOKEN_REQUIRED', 'Facebook accessToken is required.');
    }

    const profile = await fetchJsonWithTimeout(
        `https://graph.facebook.com/me?fields=id,name,email&access_token=${encodeURIComponent(payload.accessToken)}`,
    );

    const providerUserId =
        typeof profile.id === 'string' && profile.id.trim().length > 0
            ? profile.id.trim()
            : null;
    const email =
        typeof profile.email === 'string' && profile.email.trim().length > 0
            ? profile.email.trim().toLowerCase()
            : null;
    const fullName =
        typeof profile.name === 'string' && profile.name.trim().length > 0
            ? profile.name.trim()
            : null;

    if (!providerUserId || !email) {
        throw new ApiError(400, 'OAUTH_PROFILE_INVALID', 'Facebook profile is missing required fields.');
    }

    return {
        providerUserId,
        email,
        fullName: normalizeOAuthName(fullName ?? undefined, email),
    };
}

const oauthAuthUserSelect = {
    id: true,
    email: true,
    role: true,
    accountType: true,
    staffRole: true,
    trustTier: true,
    isActive: true,
    bannedAt: true,
    emailVerifiedAt: true,
    googleId: true,
    facebookId: true,
} satisfies Prisma.UserSelect;

function getProviderLabel(provider: OAuthProvider): 'Google' | 'Facebook' {
    return provider === 'GOOGLE' ? 'Google' : 'Facebook';
}

function getLinkedProviderId(user: OAuthAuthUser, provider: OAuthProvider): string | null {
    if (provider === 'GOOGLE') {
        return user.googleId;
    }
    return user.facebookId;
}

function throwOAuthConflictIfUniqueViolation(error: unknown): void {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ApiError(409, 'OAUTH_LINK_CONFLICT', 'OAuth account conflicts with an existing identity.');
    }
}

async function findOAuthUserByProvider(
    provider: OAuthProvider,
    providerUserId: string,
): Promise<OAuthAuthUser | null> {
    if (provider === 'GOOGLE') {
        return prisma.user.findUnique({
            where: { googleId: providerUserId },
            select: oauthAuthUserSelect,
        });
    }

    return prisma.user.findUnique({
        where: { facebookId: providerUserId },
        select: oauthAuthUserSelect,
    });
}

async function updateOAuthUser(
    user: OAuthAuthUser,
    provider: OAuthProvider,
    profile: OAuthProfile,
): Promise<OAuthAuthUser> {
    const linkedProviderId = getLinkedProviderId(user, provider);
    if (linkedProviderId && linkedProviderId !== profile.providerUserId) {
        throw new ApiError(409, 'OAUTH_LINK_CONFLICT', `${getProviderLabel(provider)} account is linked elsewhere.`);
    }

    const data: Prisma.UserUpdateInput = {
        lastLoginAt: new Date(),
        profile: {
            upsert: {
                create: {
                    fullName: profile.fullName,
                },
                update: {},
            },
        },
    };

    if (!user.emailVerifiedAt) {
        data.emailVerifiedAt = new Date();
    }

    if (!user.email) {
        data.email = profile.email;
    }

    if (provider === 'GOOGLE' && !user.googleId) {
        data.googleId = profile.providerUserId;
    }

    if (provider === 'FACEBOOK' && !user.facebookId) {
        data.facebookId = profile.providerUserId;
    }

    return prisma.user.update({
        where: { id: user.id },
        data,
        select: oauthAuthUserSelect,
    });
}

async function createOAuthUser(
    provider: OAuthProvider,
    profile: OAuthProfile,
): Promise<OAuthAuthUser> {
    return prisma.user.create({
        data: {
            email: profile.email,
            emailVerifiedAt: new Date(),
            googleId: provider === 'GOOGLE' ? profile.providerUserId : null,
            facebookId: provider === 'FACEBOOK' ? profile.providerUserId : null,
            lastLoginAt: new Date(),
            profile: {
                create: {
                    fullName: profile.fullName,
                },
            },
        },
        select: oauthAuthUserSelect,
    });
}

async function loginWithOAuthProfile(
    provider: OAuthProvider,
    profile: OAuthProfile,
): Promise<LoginResult> {
    const linkedUser = await findOAuthUserByProvider(provider, profile.providerUserId);
    if (linkedUser) {
        assertActiveUser(linkedUser);
        try {
            const updatedLinkedUser = await updateOAuthUser(linkedUser, provider, profile);
            return createLoginResult(updatedLinkedUser, profile.email);
        } catch (error) {
            throwOAuthConflictIfUniqueViolation(error);
            throw error;
        }
    }

    const userByEmail = await prisma.user.findUnique({
        where: { email: profile.email },
        select: oauthAuthUserSelect,
    });

    if (userByEmail) {
        assertActiveUser(userByEmail);
        try {
            const updatedUser = await updateOAuthUser(userByEmail, provider, profile);
            return createLoginResult(updatedUser, profile.email);
        } catch (error) {
            throwOAuthConflictIfUniqueViolation(error);
            throw error;
        }
    }

    try {
        const createdUser = await createOAuthUser(provider, profile);
        return createLoginResult(createdUser, profile.email);
    } catch (error) {
        throwOAuthConflictIfUniqueViolation(error);
        throw error;
    }
}

export async function loginWithGoogleOAuth(payload: GoogleOAuthBody): Promise<LoginResult> {
    const profile = await resolveGoogleOAuthProfile(payload);
    return loginWithOAuthProfile('GOOGLE', profile);
}

export async function loginWithFacebookOAuth(payload: FacebookOAuthBody): Promise<LoginResult> {
    const profile = await resolveFacebookOAuthProfile(payload);
    return loginWithOAuthProfile('FACEBOOK', profile);
}

export async function registerWithEmail(payload: RegisterBody): Promise<RegisterResult> {
    const existingUser = await prisma.user.findUnique({
        where: { email: payload.email },
        select: { id: true },
    });

    if (existingUser) {
        throw new ApiError(409, 'EMAIL_ALREADY_IN_USE', 'Email is already in use.');
    }

    const passwordHash = await hashPassword(payload.password);

    const user = await prisma.user.create({
        data: {
            email: payload.email,
            passwordHash,
            accountType: payload.accountType,
            profile: {
                create: {
                    fullName: payload.fullName,
                },
            },
        },
        select: {
            id: true,
            email: true,
        },
    });

    await sendVerificationEmail(user.id, user.email ?? payload.email, payload.fullName);

    return {
        userId: user.id,
        email: user.email ?? payload.email,
        emailVerificationRequired: true,
    };
}

export async function verifyEmailToken(token: string): Promise<void> {
    const redisKey = buildEmailVerificationKey(token);
    const storedUserId = await redis.get(redisKey);

    if (!storedUserId) {
        throw new ApiError(400, 'INVALID_OR_EXPIRED_TOKEN', 'Verification token is invalid or expired.');
    }

    const userId = Number(storedUserId);
    if (!Number.isInteger(userId) || userId <= 0) {
        throw new ApiError(400, 'INVALID_OR_EXPIRED_TOKEN', 'Verification token is invalid or expired.');
    }

    const updatedUser = await prisma.user.updateMany({
        where: {
            id: userId,
            emailVerifiedAt: null,
        },
        data: {
            emailVerifiedAt: new Date(),
        },
    });

    if (updatedUser.count === 0) {
        throw new ApiError(404, 'USER_NOT_FOUND', 'User not found or already verified.');
    }

    await redis.del(redisKey);
}

export async function resendVerificationEmail(
    payload: ResendVerificationBody,
): Promise<ResendVerificationResult> {
    const user = await prisma.user.findUnique({
        where: { email: payload.email },
        select: {
            id: true,
            email: true,
            isActive: true,
            bannedAt: true,
            emailVerifiedAt: true,
            profile: {
                select: {
                    fullName: true,
                },
            },
        },
    });

    if (!user || !user.isActive || user.bannedAt || user.emailVerifiedAt) {
        return { requested: true };
    }

    await sendVerificationEmail(
        user.id,
        user.email ?? payload.email,
        user.profile?.fullName ?? 'Souqly User',
    );

    return { requested: true };
}

export async function requestPasswordReset(payload: ForgotPasswordBody): Promise<ForgotPasswordResult> {
    const user = await prisma.user.findUnique({
        where: { email: payload.email },
        select: {
            id: true,
            email: true,
            passwordHash: true,
            isActive: true,
            bannedAt: true,
            profile: {
                select: {
                    fullName: true,
                },
            },
        },
    });

    if (!user || !user.passwordHash || !user.isActive || user.bannedAt) {
        return { requested: true };
    }

    const token = createEmailVerificationToken();
    const redisKey = buildPasswordResetKey(token);
    await redis.setex(redisKey, PASSWORD_RESET_TTL_SECONDS, String(user.id));

    const emailSent = await sendEmail({
        to: user.email ?? payload.email,
        subject: 'Reset your Souqly password',
        html: resetPasswordEmailHtml(user.profile?.fullName ?? 'Souqly User', token),
    });

    if (!emailSent) {
        throw new ApiError(503, 'EMAIL_DELIVERY_FAILED', 'Could not send password reset email.');
    }

    return { requested: true };
}

export async function resetPassword(payload: ResetPasswordBody): Promise<ResetPasswordResult> {
    const redisKey = buildPasswordResetKey(payload.token);
    const storedUserId = await redis.get(redisKey);

    if (!storedUserId) {
        throw new ApiError(400, 'INVALID_OR_EXPIRED_TOKEN', 'Reset token is invalid or expired.');
    }

    const userId = Number(storedUserId);
    if (!Number.isInteger(userId) || userId <= 0) {
        throw new ApiError(400, 'INVALID_OR_EXPIRED_TOKEN', 'Reset token is invalid or expired.');
    }

    const newPasswordHash = await hashPassword(payload.newPassword);
    const updatedUser = await prisma.user.updateMany({
        where: {
            id: userId,
            isActive: true,
            bannedAt: null,
        },
        data: {
            passwordHash: newPasswordHash,
        },
    });

    if (updatedUser.count === 0) {
        throw new ApiError(404, 'USER_NOT_FOUND', 'User not found.');
    }

    await redis.del(redisKey);
    return { reset: true };
}

export async function changePassword(
    userId: number,
    payload: ChangePasswordBody,
): Promise<ChangePasswordResult> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            passwordHash: true,
            isActive: true,
            bannedAt: true,
        },
    });

    if (!user) {
        throw new ApiError(404, 'USER_NOT_FOUND', 'User not found.');
    }

    if (!user.isActive || user.bannedAt) {
        throw new ApiError(403, 'ACCOUNT_DISABLED', 'Account is disabled.');
    }

    if (!user.passwordHash) {
        throw new ApiError(400, 'PASSWORD_LOGIN_NOT_AVAILABLE', 'Use social login for this account.');
    }

    const isCurrentPasswordValid = await comparePassword(payload.currentPassword, user.passwordHash);
    if (!isCurrentPasswordValid) {
        throw new ApiError(401, 'INVALID_CURRENT_PASSWORD', 'Current password is incorrect.');
    }

    const isSamePassword = await comparePassword(payload.newPassword, user.passwordHash);
    if (isSamePassword) {
        throw new ApiError(400, 'NEW_PASSWORD_MUST_DIFFER', 'New password must be different.');
    }

    const newPasswordHash = await hashPassword(payload.newPassword);
    await prisma.user.update({
        where: { id: user.id },
        data: {
            passwordHash: newPasswordHash,
        },
    });

    return { changed: true };
}

export async function requestPhoneVerificationOtp(
    userId: number,
    payload: RequestPhoneVerificationBody,
): Promise<RequestPhoneVerificationResult> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            isActive: true,
            bannedAt: true,
        },
    });

    if (!user) {
        throw new ApiError(404, 'USER_NOT_FOUND', 'User not found.');
    }
    assertActiveUser(user);

    const phone = payload.phone;
    const phoneOwner = await prisma.user.findFirst({
        where: {
            phone,
            id: {
                not: user.id,
            },
        },
        select: {
            id: true,
        },
    });

    if (phoneOwner) {
        throw new ApiError(409, 'PHONE_ALREADY_IN_USE', 'Phone number is already in use.');
    }

    const code = await generateOTP(phone);
    const delivery = await sendWhatsAppOTP({ phone, code });
    if (!delivery) {
        throw new ApiError(503, 'OTP_DELIVERY_FAILED', 'Could not send WhatsApp OTP.');
    }

    await redis.setex(buildPendingPhoneVerificationKey(user.id), PHONE_VERIFICATION_TTL_SECONDS, phone);

    return {
        requested: true,
        channel: 'WHATSAPP',
        expiresInSeconds: PHONE_VERIFICATION_TTL_SECONDS,
    };
}

export async function verifyPhoneOtp(
    userId: number,
    payload: VerifyPhoneOtpBody,
): Promise<VerifyPhoneOtpResult> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            isActive: true,
            bannedAt: true,
        },
    });

    if (!user) {
        throw new ApiError(404, 'USER_NOT_FOUND', 'User not found.');
    }
    assertActiveUser(user);

    const phone = payload.phone;
    const pendingPhone = await redis.get(buildPendingPhoneVerificationKey(user.id));
    if (!pendingPhone || pendingPhone !== phone) {
        throw new ApiError(400, 'INVALID_OR_EXPIRED_OTP', 'OTP request is invalid or expired.');
    }

    const isValidOtp = await verifyOTP(phone, payload.code);
    if (!isValidOtp) {
        throw new ApiError(400, 'INVALID_OR_EXPIRED_OTP', 'OTP code is invalid or expired.');
    }

    const phoneOwner = await prisma.user.findFirst({
        where: {
            phone,
            id: {
                not: user.id,
            },
        },
        select: {
            id: true,
        },
    });

    if (phoneOwner) {
        throw new ApiError(409, 'PHONE_ALREADY_IN_USE', 'Phone number is already in use.');
    }

    await prisma.user.update({
        where: { id: user.id },
        data: {
            phone,
            phoneVerifiedAt: new Date(),
        },
    });

    await redis.del(buildPendingPhoneVerificationKey(user.id));

    return {
        verified: true,
        phone,
    };
}

export async function loginWithEmail(payload: LoginBody): Promise<LoginResult> {
    const user = await prisma.user.findUnique({
        where: { email: payload.email },
        select: {
            id: true,
            email: true,
            passwordHash: true,
            role: true,
            accountType: true,
            staffRole: true,
            trustTier: true,
            identityVerificationStatus: true,
            identityVerifiedAt: true,
            isActive: true,
            bannedAt: true,
            emailVerifiedAt: true,
        },
    });

    if (!user) {
        throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
    }

    if (!user.isActive || user.bannedAt) {
        throw new ApiError(403, 'ACCOUNT_DISABLED', 'Account is disabled.');
    }

    if (!user.passwordHash) {
        throw new ApiError(400, 'PASSWORD_LOGIN_NOT_AVAILABLE', 'Use social login for this account.');
    }

    const isPasswordValid = await comparePassword(payload.password, user.passwordHash);
    if (!isPasswordValid) {
        throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
    }

    if (!user.emailVerifiedAt) {
        throw new ApiError(403, 'EMAIL_NOT_VERIFIED', 'Email verification is required before login.');
    }

    await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
    });

    return createLoginResult(user, payload.email);
}

export async function refreshAccessToken(refreshToken: string): Promise<RefreshAccessTokenResult> {
    let payload: { userId: number; version: number };

    try {
        payload = verifyRefreshToken(refreshToken);
    } catch {
        throw new ApiError(401, 'INVALID_REFRESH_TOKEN', 'Invalid or expired refresh token.');
    }

    const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: {
            id: true,
            role: true,
            accountType: true,
            staffRole: true,
            trustTier: true,
            identityVerificationStatus: true,
            identityVerifiedAt: true,
            isActive: true,
            bannedAt: true,
            emailVerifiedAt: true,
        },
    });

    if (!user) {
        throw new ApiError(401, 'INVALID_REFRESH_TOKEN', 'Invalid or expired refresh token.');
    }

    if (!user.isActive || user.bannedAt) {
        throw new ApiError(403, 'ACCOUNT_DISABLED', 'Account is disabled.');
    }

    if (!user.emailVerifiedAt) {
        throw new ApiError(403, 'EMAIL_NOT_VERIFIED', 'Email verification is required before login.');
    }

    return {
        accessToken: signAccessToken({
            userId: user.id,
            role: user.role,
            accountType: user.accountType,
            staffRole: user.staffRole,
            trustTier: user.trustTier,
        }),
        tokenType: 'Bearer',
    };
}

export async function getCurrentUser(userId: number): Promise<CurrentUserResult> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            email: true,
            phone: true,
            role: true,
            accountType: true,
            staffRole: true,
            trustTier: true,
            identityVerificationStatus: true,
            identityVerifiedAt: true,
            isActive: true,
            bannedAt: true,
            emailVerifiedAt: true,
            phoneVerifiedAt: true,
            profile: {
                select: {
                    fullName: true,
                    countryId: true,
                    cityId: true,
                },
            },
        },
    });

    if (!user) {
        throw new ApiError(404, 'USER_NOT_FOUND', 'User not found.');
    }

    if (!user.isActive || user.bannedAt) {
        throw new ApiError(403, 'ACCOUNT_DISABLED', 'Account is disabled.');
    }

    return {
        id: user.id,
        email: user.email,
        phone: user.phone,
        role: user.role,
        accountType: user.accountType,
        staffRole: user.staffRole,
        trustTier: user.trustTier,
        isActive: user.isActive,
        emailVerified: Boolean(user.emailVerifiedAt),
        phoneVerified: Boolean(user.phoneVerifiedAt),
        identityVerificationStatus: user.identityVerificationStatus,
        identityVerifiedAt: user.identityVerifiedAt?.toISOString() ?? null,
        fullName: user.profile?.fullName ?? null,
        countryId: user.profile?.countryId ?? null,
        cityId: user.profile?.cityId ?? null,
    };
}
