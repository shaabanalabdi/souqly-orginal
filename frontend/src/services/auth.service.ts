import { requestData } from './client';
import type { AccountType, SessionUser } from '../types/domain';

export interface RegisterPayload {
  email: string;
  password: string;
  fullName: string;
  accountType?: AccountType;
}

export interface RegisterResult {
  userId: number;
  email: string;
  emailVerificationRequired: boolean;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface GoogleOAuthLoginPayload {
  idToken?: string;
  email?: string;
  fullName?: string;
  providerUserId?: string;
}

export interface FacebookOAuthLoginPayload {
  accessToken?: string;
  email?: string;
  fullName?: string;
  providerUserId?: string;
}

export interface LoginResult {
  accessToken: string;
  tokenType: 'Bearer';
  user: {
    id: number;
    email: string;
  };
}

export interface RefreshResult {
  accessToken: string;
  tokenType: 'Bearer';
}

export interface ResetPasswordPayload {
  token: string;
  newPassword: string;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

export interface VerifyPhoneOtpPayload {
  phone: string;
  code: string;
}

export const authService = {
  register(payload: RegisterPayload) {
    return requestData<RegisterResult>({
      method: 'POST',
      url: '/auth/register',
      data: payload,
    });
  },

  resendVerification(email: string) {
    return requestData<{ requested: true }>({
      method: 'POST',
      url: '/auth/resend-verification',
      data: { email },
    });
  },

  verifyEmail(token: string) {
    return requestData<{ verified: true }>({
      method: 'GET',
      url: '/auth/verify-email',
      params: { token },
    });
  },

  login(payload: LoginPayload) {
    return requestData<LoginResult>({
      method: 'POST',
      url: '/auth/login',
      data: payload,
    });
  },

  loginWithGoogleOAuth(payload: GoogleOAuthLoginPayload) {
    return requestData<LoginResult>({
      method: 'POST',
      url: '/auth/oauth/google',
      data: payload,
    });
  },

  loginWithFacebookOAuth(payload: FacebookOAuthLoginPayload) {
    return requestData<LoginResult>({
      method: 'POST',
      url: '/auth/oauth/facebook',
      data: payload,
    });
  },

  refresh() {
    return requestData<RefreshResult>({
      method: 'POST',
      url: '/auth/refresh',
    });
  },

  logout() {
    return requestData<{ loggedOut: true }>({
      method: 'POST',
      url: '/auth/logout',
    });
  },

  me() {
    return requestData<SessionUser>({
      method: 'GET',
      url: '/auth/me',
    });
  },

  forgotPassword(email: string) {
    return requestData<{ requested: true }>({
      method: 'POST',
      url: '/auth/forgot-password',
      data: { email },
    });
  },

  resetPassword(payload: ResetPasswordPayload) {
    return requestData<{ reset: true }>({
      method: 'POST',
      url: '/auth/reset-password',
      data: payload,
    });
  },

  changePassword(payload: ChangePasswordPayload) {
    return requestData<{ changed: true }>({
      method: 'POST',
      url: '/auth/change-password',
      data: payload,
    });
  },

  requestPhoneVerification(phone: string) {
    return requestData<{ requested: true; channel: 'WHATSAPP'; expiresInSeconds: number }>({
      method: 'POST',
      url: '/auth/phone-verification/request',
      data: { phone },
    });
  },

  verifyPhoneOtp(payload: VerifyPhoneOtpPayload) {
    return requestData<{ verified: true; phone: string }>({
      method: 'POST',
      url: '/auth/phone-verification/confirm',
      data: payload,
    });
  },
};
