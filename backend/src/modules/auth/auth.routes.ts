import { Router } from 'express';
import {
    authLoginLimiter,
    authRegisterLimiter,
    forgotPasswordLimiter,
    otpLimiter,
} from '../../shared/middleware/rateLimiter.js';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { requireCsrfToken } from '../../shared/middleware/csrf.js';
import { validate } from '../../shared/middleware/validate.js';
import {
    changePasswordController,
    facebookOAuthLoginController,
    forgotPasswordController,
    googleOAuthLoginController,
    loginController,
    logoutController,
    meController,
    requestPhoneVerificationController,
    resendVerificationController,
    resetPasswordController,
    refreshController,
    registerController,
    verifyPhoneOtpController,
    verifyEmailController,
} from './auth.controller.js';
import {
    changePasswordBodySchema,
    facebookOAuthBodySchema,
    forgotPasswordBodySchema,
    googleOAuthBodySchema,
    loginBodySchema,
    requestPhoneVerificationBodySchema,
    registerBodySchema,
    resendVerificationBodySchema,
    resetPasswordBodySchema,
    verifyPhoneOtpBodySchema,
    verifyEmailQuerySchema,
} from './auth.validation.js';

const authRoutes = Router();

authRoutes.post('/register', authRegisterLimiter, validate({ body: registerBodySchema }), registerController);
authRoutes.post(
    '/resend-verification',
    authRegisterLimiter,
    validate({ body: resendVerificationBodySchema }),
    resendVerificationController,
);
authRoutes.post('/login', authLoginLimiter, validate({ body: loginBodySchema }), loginController);
authRoutes.post(
    '/oauth/google',
    authLoginLimiter,
    validate({ body: googleOAuthBodySchema }),
    googleOAuthLoginController,
);
authRoutes.post(
    '/oauth/facebook',
    authLoginLimiter,
    validate({ body: facebookOAuthBodySchema }),
    facebookOAuthLoginController,
);
authRoutes.post('/refresh', requireCsrfToken, refreshController);
authRoutes.post('/logout', requireCsrfToken, logoutController);
authRoutes.post(
    '/forgot-password',
    forgotPasswordLimiter,
    validate({ body: forgotPasswordBodySchema }),
    forgotPasswordController,
);
authRoutes.post(
    '/reset-password',
    validate({ body: resetPasswordBodySchema }),
    resetPasswordController,
);
authRoutes.get('/me', authenticate, meController);
authRoutes.post(
    '/change-password',
    authenticate,
    validate({ body: changePasswordBodySchema }),
    changePasswordController,
);
authRoutes.post(
    '/phone-verification/request',
    authenticate,
    otpLimiter,
    validate({ body: requestPhoneVerificationBodySchema }),
    requestPhoneVerificationController,
);
authRoutes.post(
    '/phone-verification/confirm',
    authenticate,
    validate({ body: verifyPhoneOtpBodySchema }),
    verifyPhoneOtpController,
);
authRoutes.get('/verify-email', validate({ query: verifyEmailQuerySchema }), verifyEmailController);

export default authRoutes;
