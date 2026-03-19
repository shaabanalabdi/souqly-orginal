import request from 'supertest';
import app from '../app.js';
import { prisma } from '../shared/utils/prisma.js';
import { redis } from '../shared/utils/redis.js';
import {
    authLoginLimiter,
    authRegisterLimiter,
    forgotPasswordLimiter,
    otpLimiter,
} from '../shared/middleware/rateLimiter.js';
import * as bcryptUtils from '../shared/utils/bcrypt.js';
import * as emailUtils from '../shared/utils/email.js';
import * as otpUtils from '../shared/utils/otp.js';
import * as whatsappUtils from '../shared/utils/whatsapp.js';
import { signAccessToken, signRefreshToken } from '../shared/utils/jwt.js';

describe('Auth routes', () => {
    afterEach(() => {
        const testIpKey = '::ffff:127.0.0.1';
        (
            [
                authLoginLimiter,
                authRegisterLimiter,
                forgotPasswordLimiter,
                otpLimiter,
            ] as Array<{ resetKey?: (key: string) => void }>
        ).forEach((limiter) => limiter.resetKey?.(testIpKey));
    });

    it('POST /api/v1/auth/register creates a user and sends verification email', async () => {
        jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);
        jest.spyOn(bcryptUtils, 'hashPassword').mockResolvedValue('hashed-password');
        jest.spyOn(prisma.user, 'create').mockResolvedValue({
            id: 7,
            email: 'new@souqly.com',
        } as never);
        const redisSetexSpy = jest.spyOn(redis, 'setex').mockResolvedValue('OK' as never);
        jest.spyOn(emailUtils, 'sendEmail').mockResolvedValue(true);

        const response = await request(app).post('/api/v1/auth/register').send({
            email: 'new@souqly.com',
            password: 'StrongP@ss1',
            fullName: 'New User',
        });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toMatchObject({
            userId: 7,
            email: 'new@souqly.com',
            emailVerificationRequired: true,
        });
        expect(redisSetexSpy).toHaveBeenCalledTimes(1);
        expect(redisSetexSpy.mock.calls[0][0]).toMatch(/^email_verify:/);
        expect(redisSetexSpy.mock.calls[0][1]).toBe(3600);
        expect(redisSetexSpy.mock.calls[0][2]).toBe('7');
    });

    it('POST /api/v1/auth/register returns conflict when email exists', async () => {
        jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({ id: 1 } as never);

        const response = await request(app).post('/api/v1/auth/register').send({
            email: 'existing@souqly.com',
            password: 'StrongP@ss1',
            fullName: 'Existing User',
        });

        expect(response.status).toBe(409);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('EMAIL_ALREADY_IN_USE');
    });

    it('POST /api/v1/auth/resend-verification sends token for unverified active users', async () => {
        jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({
            id: 13,
            email: 'pending@souqly.com',
            isActive: true,
            bannedAt: null,
            emailVerifiedAt: null,
            profile: {
                fullName: 'Pending User',
            },
        } as never);
        const redisSetexSpy = jest.spyOn(redis, 'setex').mockResolvedValue('OK' as never);
        jest.spyOn(emailUtils, 'sendEmail').mockResolvedValue(true);

        const response = await request(app).post('/api/v1/auth/resend-verification').send({
            email: 'pending@souqly.com',
        });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.requested).toBe(true);
        expect(redisSetexSpy).toHaveBeenCalledTimes(1);
        expect(redisSetexSpy.mock.calls[0][0]).toMatch(/^email_verify:/);
    });

    it('POST /api/v1/auth/resend-verification returns success for unknown email', async () => {
        jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);

        const response = await request(app).post('/api/v1/auth/resend-verification').send({
            email: 'missing@souqly.com',
        });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.requested).toBe(true);
    });

    it('GET /api/v1/auth/verify-email returns invalid when token is not found', async () => {
        jest.spyOn(redis, 'get').mockResolvedValue(null);

        const response = await request(app).get(`/api/v1/auth/verify-email?token=${'a'.repeat(32)}`);

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('INVALID_OR_EXPIRED_TOKEN');
    });

    it('GET /api/v1/auth/verify-email verifies user when token is valid', async () => {
        jest.spyOn(redis, 'get').mockResolvedValue('9');
        const updateManySpy = jest.spyOn(prisma.user, 'updateMany').mockResolvedValue({ count: 1 } as never);
        const redisDelSpy = jest.spyOn(redis, 'del').mockResolvedValue(1 as never);

        const response = await request(app).get(`/api/v1/auth/verify-email?token=${'b'.repeat(32)}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.verified).toBe(true);
        expect(updateManySpy).toHaveBeenCalledTimes(1);
        expect(redisDelSpy).toHaveBeenCalledTimes(1);
    });

    it('POST /api/v1/auth/login returns access token and refresh cookie', async () => {
        jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({
            id: 11,
            email: 'verified@souqly.com',
            passwordHash: 'hashed-password',
            role: 'USER',
            accountType: 'INDIVIDUAL',
            staffRole: 'NONE',
            trustTier: 'NEW',
            isActive: true,
            bannedAt: null,
            emailVerifiedAt: new Date(),
        } as never);
        jest.spyOn(bcryptUtils, 'comparePassword').mockResolvedValue(true);
        jest.spyOn(prisma.user, 'update').mockResolvedValue({ id: 11 } as never);

        const response = await request(app).post('/api/v1/auth/login').send({
            email: 'verified@souqly.com',
            password: 'StrongP@ss1',
        });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.tokenType).toBe('Bearer');
        expect(typeof response.body.data.accessToken).toBe('string');
        expect(response.body.data.accessToken.length).toBeGreaterThan(20);

        const rawCookies = response.headers['set-cookie'];
        const cookies = Array.isArray(rawCookies) ? rawCookies : rawCookies ? [rawCookies] : [];
        expect(cookies.length).toBeGreaterThan(0);
        expect(cookies.some((cookie: string) => cookie.includes('souqly_refresh_token='))).toBe(true);
        expect(cookies.some((cookie: string) => cookie.includes('souqly_refresh_token=') && cookie.includes('HttpOnly'))).toBe(true);
        expect(cookies.some((cookie: string) => cookie.includes('souqly_csrf_token='))).toBe(true);
    });

    it('POST /api/v1/auth/login returns unauthorized for wrong credentials', async () => {
        jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);

        const response = await request(app).post('/api/v1/auth/login').send({
            email: 'unknown@souqly.com',
            password: 'StrongP@ss1',
        });

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('POST /api/v1/auth/login blocks unverified accounts', async () => {
        jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({
            id: 12,
            email: 'unverified@souqly.com',
            passwordHash: 'hashed-password',
            role: 'USER',
            accountType: 'INDIVIDUAL',
            staffRole: 'NONE',
            trustTier: 'NEW',
            isActive: true,
            bannedAt: null,
            emailVerifiedAt: null,
        } as never);
        jest.spyOn(bcryptUtils, 'comparePassword').mockResolvedValue(true);

        const response = await request(app).post('/api/v1/auth/login').send({
            email: 'unverified@souqly.com',
            password: 'StrongP@ss1',
        });

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('EMAIL_NOT_VERIFIED');
    });

    it('POST /api/v1/auth/oauth/google creates a user in oauth mock mode', async () => {
        const findUniqueSpy = jest.spyOn(prisma.user, 'findUnique');
        findUniqueSpy.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
        jest.spyOn(prisma.user, 'create').mockResolvedValue({
            id: 41,
            email: 'google@souqly.com',
            role: 'USER',
            accountType: 'INDIVIDUAL',
            staffRole: 'NONE',
            trustTier: 'NEW',
            isActive: true,
            bannedAt: null,
            emailVerifiedAt: new Date(),
            googleId: 'google:google@souqly.com',
            facebookId: null,
        } as never);

        const response = await request(app).post('/api/v1/auth/oauth/google').send({
            email: 'google@souqly.com',
            fullName: 'Google User',
        });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.tokenType).toBe('Bearer');
        expect(response.body.data.user.email).toBe('google@souqly.com');

        const rawCookies = response.headers['set-cookie'];
        const cookies = Array.isArray(rawCookies) ? rawCookies : rawCookies ? [rawCookies] : [];
        expect(cookies.length).toBeGreaterThan(0);
        expect(cookies.some((cookie: string) => cookie.includes('souqly_refresh_token='))).toBe(true);
        expect(cookies.some((cookie: string) => cookie.includes('souqly_csrf_token='))).toBe(true);
    });

    it('POST /api/v1/auth/oauth/google links provider for existing email account', async () => {
        const findUniqueSpy = jest.spyOn(prisma.user, 'findUnique');
        findUniqueSpy
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({
                id: 42,
                email: 'existing-google@souqly.com',
                role: 'USER',
                accountType: 'INDIVIDUAL',
                staffRole: 'NONE',
                trustTier: 'NEW',
                isActive: true,
                bannedAt: null,
                emailVerifiedAt: null,
                googleId: null,
                facebookId: null,
            } as never);

        const updateSpy = jest.spyOn(prisma.user, 'update').mockResolvedValue({
            id: 42,
            email: 'existing-google@souqly.com',
            role: 'USER',
            accountType: 'INDIVIDUAL',
            staffRole: 'NONE',
            trustTier: 'NEW',
            isActive: true,
            bannedAt: null,
            emailVerifiedAt: new Date(),
            googleId: 'google:existing-google@souqly.com',
            facebookId: null,
        } as never);

        const response = await request(app).post('/api/v1/auth/oauth/google').send({
            email: 'existing-google@souqly.com',
            fullName: 'Existing OAuth User',
        });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.user.email).toBe('existing-google@souqly.com');
        expect(updateSpy).toHaveBeenCalledTimes(1);
        expect(updateSpy.mock.calls[0][0].data).toMatchObject({
            googleId: 'google:existing-google@souqly.com',
        });
    });

    it('POST /api/v1/auth/oauth/facebook requires email in oauth mock mode', async () => {
        const response = await request(app).post('/api/v1/auth/oauth/facebook').send({});

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('OAUTH_EMAIL_REQUIRED');
    });

    it('POST /api/v1/auth/refresh returns a new access token when cookie is valid', async () => {
        const refreshToken = signRefreshToken({ userId: 11, version: 1 });
        const csrfToken = 'csrf-valid-token';
        jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({
            id: 11,
            role: 'USER',
            accountType: 'INDIVIDUAL',
            staffRole: 'NONE',
            trustTier: 'NEW',
            isActive: true,
            bannedAt: null,
            emailVerifiedAt: new Date(),
        } as never);

        const response = await request(app)
            .post('/api/v1/auth/refresh')
            .set('Cookie', [`souqly_refresh_token=${refreshToken}`, `souqly_csrf_token=${csrfToken}`])
            .set('x-csrf-token', csrfToken);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.tokenType).toBe('Bearer');
        expect(typeof response.body.data.accessToken).toBe('string');
        expect(response.body.data.accessToken.length).toBeGreaterThan(20);
    });

    it('POST /api/v1/auth/refresh returns error when cookie is missing', async () => {
        const csrfToken = 'csrf-token';
        const response = await request(app)
            .post('/api/v1/auth/refresh')
            .set('Cookie', [`souqly_csrf_token=${csrfToken}`])
            .set('x-csrf-token', csrfToken);

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('REFRESH_TOKEN_REQUIRED');
    });

    it('POST /api/v1/auth/refresh returns error when csrf token is missing', async () => {
        const refreshToken = signRefreshToken({ userId: 11, version: 1 });

        const response = await request(app)
            .post('/api/v1/auth/refresh')
            .set('Cookie', [`souqly_refresh_token=${refreshToken}`]);

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('CSRF_TOKEN_INVALID');
    });

    it('POST /api/v1/auth/refresh returns error for invalid token', async () => {
        const csrfToken = 'csrf-token';
        const response = await request(app)
            .post('/api/v1/auth/refresh')
            .set('Cookie', ['souqly_refresh_token=invalid-token', `souqly_csrf_token=${csrfToken}`])
            .set('x-csrf-token', csrfToken);

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('INVALID_REFRESH_TOKEN');
    });

    it('POST /api/v1/auth/logout clears refresh token cookie', async () => {
        const csrfToken = 'csrf-token';
        const response = await request(app)
            .post('/api/v1/auth/logout')
            .set('Cookie', [`souqly_csrf_token=${csrfToken}`])
            .set('x-csrf-token', csrfToken);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.loggedOut).toBe(true);

        const rawCookies = response.headers['set-cookie'];
        const cookies = Array.isArray(rawCookies) ? rawCookies : rawCookies ? [rawCookies] : [];
        expect(cookies.length).toBeGreaterThan(0);
        expect(cookies.some((cookie: string) => cookie.includes('souqly_refresh_token='))).toBe(true);
        expect(cookies.some((cookie: string) => cookie.includes('souqly_csrf_token='))).toBe(true);
        expect(cookies.some((cookie: string) => cookie.includes('souqly_refresh_token=') && cookie.includes('HttpOnly'))).toBe(true);
    });

    it('POST /api/v1/auth/forgot-password sends reset token for valid account', async () => {
        jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({
            id: 21,
            email: 'reset@souqly.com',
            passwordHash: 'hashed-password',
            isActive: true,
            bannedAt: null,
            profile: {
                fullName: 'Reset User',
            },
        } as never);
        const redisSetexSpy = jest.spyOn(redis, 'setex').mockResolvedValue('OK' as never);
        jest.spyOn(emailUtils, 'sendEmail').mockResolvedValue(true);

        const response = await request(app).post('/api/v1/auth/forgot-password').send({
            email: 'reset@souqly.com',
        });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.requested).toBe(true);
        expect(redisSetexSpy).toHaveBeenCalledTimes(1);
        expect(redisSetexSpy.mock.calls[0][0]).toMatch(/^password_reset:/);
    });

    it('POST /api/v1/auth/forgot-password returns success for unknown email', async () => {
        jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);

        const response = await request(app).post('/api/v1/auth/forgot-password').send({
            email: 'unknown@souqly.com',
        });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.requested).toBe(true);
    });

    it('POST /api/v1/auth/reset-password returns invalid for unknown token', async () => {
        jest.spyOn(redis, 'get').mockResolvedValue(null);

        const response = await request(app).post('/api/v1/auth/reset-password').send({
            token: 'x'.repeat(32),
            newPassword: 'NewStrongP@ss1',
        });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('INVALID_OR_EXPIRED_TOKEN');
    });

    it('POST /api/v1/auth/reset-password updates password for valid token', async () => {
        jest.spyOn(redis, 'get').mockResolvedValue('21');
        jest.spyOn(bcryptUtils, 'hashPassword').mockResolvedValue('new-hashed-password');
        const updateManySpy = jest.spyOn(prisma.user, 'updateMany').mockResolvedValue({ count: 1 } as never);
        const redisDelSpy = jest.spyOn(redis, 'del').mockResolvedValue(1 as never);

        const response = await request(app).post('/api/v1/auth/reset-password').send({
            token: 'y'.repeat(32),
            newPassword: 'NewStrongP@ss1',
        });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.reset).toBe(true);
        expect(updateManySpy).toHaveBeenCalledTimes(1);
        expect(redisDelSpy).toHaveBeenCalledTimes(1);
    });

    it('GET /api/v1/auth/me returns current user when token is valid', async () => {
        const accessToken = signAccessToken({ userId: 11, role: 'USER', trustTier: 'NEW' });
        jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({
            id: 11,
            email: 'me@souqly.com',
            phone: null,
            role: 'USER',
            accountType: 'INDIVIDUAL',
            staffRole: 'NONE',
            trustTier: 'NEW',
            isActive: true,
            bannedAt: null,
            emailVerifiedAt: new Date(),
            phoneVerifiedAt: null,
            profile: {
                fullName: 'Me User',
                countryId: 1,
                cityId: 10,
            },
        } as never);

        const response = await request(app)
            .get('/api/v1/auth/me')
            .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toMatchObject({
            id: 11,
            email: 'me@souqly.com',
            phone: null,
            role: 'USER',
            accountType: 'INDIVIDUAL',
            staffRole: 'NONE',
            trustTier: 'NEW',
            fullName: 'Me User',
            countryId: 1,
            cityId: 10,
        });
        expect(response.body.data.emailVerified).toBe(true);
        expect(response.body.data.phoneVerified).toBe(false);
    });

    it('POST /api/v1/auth/phone-verification/request sends whatsapp otp for authenticated user', async () => {
        const accessToken = signAccessToken({ userId: 51, role: 'USER', trustTier: 'NEW' });
        jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({
            id: 51,
            isActive: true,
            bannedAt: null,
        } as never);
        jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(null);
        jest.spyOn(otpUtils, 'generateOTP').mockResolvedValue('123456');
        const redisSetexSpy = jest.spyOn(redis, 'setex').mockResolvedValue('OK' as never);
        jest.spyOn(whatsappUtils, 'sendWhatsAppOTP').mockResolvedValue(true);

        const response = await request(app)
            .post('/api/v1/auth/phone-verification/request')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
                phone: '+963911111111',
            });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.requested).toBe(true);
        expect(response.body.data.channel).toBe('WHATSAPP');
        expect(redisSetexSpy).toHaveBeenCalledTimes(1);
        expect(redisSetexSpy.mock.calls[0][0]).toBe('phone_verify_pending:51');
    });

    it('POST /api/v1/auth/phone-verification/request rejects duplicate phone', async () => {
        const accessToken = signAccessToken({ userId: 52, role: 'USER', trustTier: 'NEW' });
        jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({
            id: 52,
            isActive: true,
            bannedAt: null,
        } as never);
        jest.spyOn(prisma.user, 'findFirst').mockResolvedValue({ id: 99 } as never);

        const response = await request(app)
            .post('/api/v1/auth/phone-verification/request')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
                phone: '+963922222222',
            });

        expect(response.status).toBe(409);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('PHONE_ALREADY_IN_USE');
    });

    it('POST /api/v1/auth/phone-verification/confirm verifies phone when otp is valid', async () => {
        const accessToken = signAccessToken({ userId: 53, role: 'USER', trustTier: 'NEW' });
        jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({
            id: 53,
            isActive: true,
            bannedAt: null,
        } as never);
        jest.spyOn(redis, 'get').mockResolvedValue('+963933333333');
        jest.spyOn(otpUtils, 'verifyOTP').mockResolvedValue(true);
        jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(null);
        jest.spyOn(prisma.user, 'update').mockResolvedValue({ id: 53 } as never);
        const redisDelSpy = jest.spyOn(redis, 'del').mockResolvedValue(1 as never);

        const response = await request(app)
            .post('/api/v1/auth/phone-verification/confirm')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
                phone: '+963933333333',
                code: '123456',
            });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.verified).toBe(true);
        expect(response.body.data.phone).toBe('+963933333333');
        expect(redisDelSpy).toHaveBeenCalledWith('phone_verify_pending:53');
    });

    it('POST /api/v1/auth/phone-verification/confirm rejects invalid otp', async () => {
        const accessToken = signAccessToken({ userId: 54, role: 'USER', trustTier: 'NEW' });
        jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({
            id: 54,
            isActive: true,
            bannedAt: null,
        } as never);
        jest.spyOn(redis, 'get').mockResolvedValue('+963944444444');
        jest.spyOn(otpUtils, 'verifyOTP').mockResolvedValue(false);

        const response = await request(app)
            .post('/api/v1/auth/phone-verification/confirm')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
                phone: '+963944444444',
                code: '000000',
            });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('INVALID_OR_EXPIRED_OTP');
    });

    it('GET /api/v1/auth/me returns unauthorized when token is missing', async () => {
        const response = await request(app).get('/api/v1/auth/me');

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('POST /api/v1/auth/change-password updates password for authenticated user', async () => {
        const accessToken = signAccessToken({ userId: 31, role: 'USER', trustTier: 'NEW' });
        jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({
            id: 31,
            passwordHash: 'old-hash',
            isActive: true,
            bannedAt: null,
        } as never);
        jest.spyOn(bcryptUtils, 'comparePassword')
            .mockResolvedValueOnce(true)
            .mockResolvedValueOnce(false);
        const hashPasswordSpy = jest.spyOn(bcryptUtils, 'hashPassword').mockResolvedValue('new-hash');
        const updateSpy = jest.spyOn(prisma.user, 'update').mockResolvedValue({ id: 31 } as never);

        const response = await request(app)
            .post('/api/v1/auth/change-password')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
                currentPassword: 'OldStrongP@ss1',
                newPassword: 'NewStrongP@ss1',
            });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.changed).toBe(true);
        expect(hashPasswordSpy).toHaveBeenCalledTimes(1);
        expect(updateSpy).toHaveBeenCalledTimes(1);
    });

    it('POST /api/v1/auth/change-password rejects wrong current password', async () => {
        const accessToken = signAccessToken({ userId: 31, role: 'USER', trustTier: 'NEW' });
        jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({
            id: 31,
            passwordHash: 'old-hash',
            isActive: true,
            bannedAt: null,
        } as never);
        jest.spyOn(bcryptUtils, 'comparePassword').mockResolvedValue(false);

        const response = await request(app)
            .post('/api/v1/auth/change-password')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
                currentPassword: 'WrongOldP@ss1',
                newPassword: 'NewStrongP@ss1',
            });

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('INVALID_CURRENT_PASSWORD');
    });
});
