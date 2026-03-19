import { randomBytes } from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { ApiError } from './errorHandler.js';

export const CSRF_TOKEN_COOKIE_NAME = 'souqly_csrf_token';
const AUTH_COOKIE_PATH = '/api/v1/auth';

export function buildCsrfCookieOptions() {
    return {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax' as const,
        path: AUTH_COOKIE_PATH,
    };
}

export function issueCsrfCookie(res: Response): string {
    const token = randomBytes(24).toString('hex');
    res.cookie(CSRF_TOKEN_COOKIE_NAME, token, {
        ...buildCsrfCookieOptions(),
        maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    return token;
}

export function requireCsrfToken(req: Request, _res: Response, next: NextFunction): void {
    const csrfFromCookie = req.cookies?.[CSRF_TOKEN_COOKIE_NAME] as string | undefined;
    const csrfFromHeader = req.header('x-csrf-token');

    if (!csrfFromCookie || !csrfFromHeader || csrfFromCookie !== csrfFromHeader) {
        throw new ApiError(403, 'CSRF_TOKEN_INVALID', 'CSRF token is missing or invalid.');
    }

    next();
}
