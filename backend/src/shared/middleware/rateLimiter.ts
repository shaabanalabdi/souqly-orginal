import rateLimit, { type Options } from 'express-rate-limit';

function buildRateLimiter(options: Partial<Options>) {
    return rateLimit({
        standardHeaders: true,
        legacyHeaders: false,
        message: {
            success: false,
            error: {
                code: 'RATE_LIMIT_EXCEEDED',
                message: 'Too many requests, please try again later.',
            },
        },
        ...options,
    });
}

export const globalRateLimiter = buildRateLimiter({
    windowMs: 15 * 60 * 1000,
    limit: 200,
});

export const authLoginLimiter = buildRateLimiter({
    windowMs: 15 * 60 * 1000,
    limit: 5,
});

export const authRegisterLimiter = buildRateLimiter({
    windowMs: 60 * 60 * 1000,
    limit: 10,
});

export const otpLimiter = buildRateLimiter({
    windowMs: 30 * 60 * 1000,
    limit: 3,
});

export const forgotPasswordLimiter = buildRateLimiter({
    windowMs: 60 * 60 * 1000,
    limit: 3,
});

export const createListingLimiter = buildRateLimiter({
    windowMs: 60 * 60 * 1000,
    limit: 20,
});

export const chatMessageLimiter = buildRateLimiter({
    windowMs: 60 * 1000,
    limit: 60,
});
