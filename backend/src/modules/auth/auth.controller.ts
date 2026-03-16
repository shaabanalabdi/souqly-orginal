import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../../shared/middleware/errorHandler.js';
import {
    changePassword,
    loginWithFacebookOAuth,
    loginWithGoogleOAuth,
    getCurrentUser,
    loginWithEmail,
    requestPhoneVerificationOtp,
    requestPasswordReset,
    refreshAccessToken,
    registerWithEmail,
    resendVerificationEmail,
    resetPassword,
    verifyPhoneOtp,
    verifyEmailToken,
} from './auth.service.js';

const REFRESH_TOKEN_COOKIE_NAME = 'souqly_refresh_token';
const REFRESH_TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const REFRESH_TOKEN_COOKIE_PATH = '/api/v1/auth';

function buildRefreshCookieBaseOptions() {
    return {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax' as const,
        path: REFRESH_TOKEN_COOKIE_PATH,
    };
}

function sendLoginSuccessResponse(res: Response, result: Awaited<ReturnType<typeof loginWithEmail>>): void {
    res.cookie(REFRESH_TOKEN_COOKIE_NAME, result.refreshToken, {
        ...buildRefreshCookieBaseOptions(),
        maxAge: REFRESH_TOKEN_MAX_AGE_MS,
    });

    res.json({
        success: true,
        data: {
            accessToken: result.accessToken,
            tokenType: result.tokenType,
            user: result.user,
        },
    });
}

export async function registerController(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const result = await registerWithEmail(req.body);
        res.status(201).json({
            success: true,
            data: result,
        });
    } catch (error) {
        next(error);
    }
}

export async function resendVerificationController(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const result = await resendVerificationEmail(req.body);
        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        next(error);
    }
}

export async function verifyEmailController(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        await verifyEmailToken(String(req.query.token));
        res.json({
            success: true,
            data: {
                verified: true,
            },
        });
    } catch (error) {
        next(error);
    }
}

export async function loginController(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const result = await loginWithEmail(req.body);
        sendLoginSuccessResponse(res, result);
    } catch (error) {
        next(error);
    }
}

export async function googleOAuthLoginController(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const result = await loginWithGoogleOAuth(req.body);
        sendLoginSuccessResponse(res, result);
    } catch (error) {
        next(error);
    }
}

export async function facebookOAuthLoginController(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const result = await loginWithFacebookOAuth(req.body);
        sendLoginSuccessResponse(res, result);
    } catch (error) {
        next(error);
    }
}

export async function forgotPasswordController(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const result = await requestPasswordReset(req.body);
        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        next(error);
    }
}

export async function resetPasswordController(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const result = await resetPassword(req.body);
        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        next(error);
    }
}

export async function refreshController(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE_NAME] as string | undefined;
        if (!refreshToken) {
            throw new ApiError(401, 'REFRESH_TOKEN_REQUIRED', 'Refresh token cookie is required.');
        }

        const result = await refreshAccessToken(refreshToken);
        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        next(error);
    }
}

export async function logoutController(_req: Request, res: Response): Promise<void> {
    res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, buildRefreshCookieBaseOptions());
    res.json({
        success: true,
        data: {
            loggedOut: true,
        },
    });
}

export async function meController(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            throw new ApiError(401, 'UNAUTHORIZED', 'Authentication token is required.');
        }

        const user = await getCurrentUser(userId);
        res.json({
            success: true,
            data: user,
        });
    } catch (error) {
        next(error);
    }
}

export async function changePasswordController(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            throw new ApiError(401, 'UNAUTHORIZED', 'Authentication token is required.');
        }

        const result = await changePassword(userId, req.body);
        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        next(error);
    }
}

export async function requestPhoneVerificationController(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            throw new ApiError(401, 'UNAUTHORIZED', 'Authentication token is required.');
        }

        const result = await requestPhoneVerificationOtp(userId, req.body);
        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        next(error);
    }
}

export async function verifyPhoneOtpController(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            throw new ApiError(401, 'UNAUTHORIZED', 'Authentication token is required.');
        }

        const result = await verifyPhoneOtp(userId, req.body);
        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        next(error);
    }
}
