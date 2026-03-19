import { create } from 'zustand';
import {
  authService,
  type FacebookOAuthLoginPayload,
  type GoogleOAuthLoginPayload,
  type LoginPayload,
  type LoginResult,
  type RegisterPayload,
} from '../services/auth.service';
import { asHttpError, setAuthToken } from '../services/http';
import type { SessionUser } from '../types/domain';

function saveAccessToken(token: string | null): void {
  setAuthToken(token);
}

async function applyLoginResult(
  set: (partial: Partial<AuthState>) => void,
  loginResult: LoginResult,
): Promise<void> {
  saveAccessToken(loginResult.accessToken);
  const user = await authService.me();

  set({
    user,
    accessToken: loginResult.accessToken,
    isAuthenticated: true,
    isLoading: false,
  });
}

interface AuthState {
  user: SessionUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  initialized: boolean;
  isLoading: boolean;
  error: string | null;
  initialize: () => Promise<void>;
  refreshUser: () => Promise<void>;
  register: (payload: RegisterPayload) => Promise<{ email: string; userId: number }>;
  login: (payload: LoginPayload) => Promise<void>;
  loginWithGoogleOAuth: (payload: GoogleOAuthLoginPayload) => Promise<void>;
  loginWithFacebookOAuth: (payload: FacebookOAuthLoginPayload) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  initialized: false,
  isLoading: false,
  error: null,

  clearError: () => {
    set({ error: null });
  },

  initialize: async () => {
    if (get().initialized || get().isLoading) {
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const user = await authService.me();
      set({
        user,
        isAuthenticated: true,
        initialized: true,
        isLoading: false,
      });
      return;
    } catch {
      // fallback to refresh flow below
    }

    try {
      const refreshed = await authService.refresh();
      saveAccessToken(refreshed.accessToken);
      const user = await authService.me();

      set({
        user,
        accessToken: refreshed.accessToken,
        isAuthenticated: true,
        initialized: true,
        isLoading: false,
      });
    } catch {
      saveAccessToken(null);
      set({
        user: null,
        accessToken: null,
        isAuthenticated: false,
        initialized: true,
        isLoading: false,
      });
    }
  },

  refreshUser: async () => {
    if (!get().isAuthenticated) {
      return;
    }

    try {
      const user = await authService.me();
      set({ user });
    } catch {
      // keep current user snapshot on transient failures
    }
  },

  register: async (payload) => {
    set({ isLoading: true, error: null });
    try {
      const result = await authService.register(payload);
      set({ isLoading: false });
      return {
        email: result.email,
        userId: result.userId,
      };
    } catch (error) {
      const httpError = asHttpError(error);
      set({ isLoading: false, error: httpError.message });
      throw httpError;
    }
  },

  login: async (payload) => {
    set({ isLoading: true, error: null });
    try {
      const loginResult = await authService.login(payload);
      await applyLoginResult(set, loginResult);
    } catch (error) {
      const httpError = asHttpError(error);
      set({
        isLoading: false,
        error: httpError.message,
        user: null,
        accessToken: null,
        isAuthenticated: false,
      });
      saveAccessToken(null);
      throw httpError;
    }
  },

  loginWithGoogleOAuth: async (payload) => {
    set({ isLoading: true, error: null });
    try {
      const loginResult = await authService.loginWithGoogleOAuth(payload);
      await applyLoginResult(set, loginResult);
    } catch (error) {
      const httpError = asHttpError(error);
      set({
        isLoading: false,
        error: httpError.message,
        user: null,
        accessToken: null,
        isAuthenticated: false,
      });
      saveAccessToken(null);
      throw httpError;
    }
  },

  loginWithFacebookOAuth: async (payload) => {
    set({ isLoading: true, error: null });
    try {
      const loginResult = await authService.loginWithFacebookOAuth(payload);
      await applyLoginResult(set, loginResult);
    } catch (error) {
      const httpError = asHttpError(error);
      set({
        isLoading: false,
        error: httpError.message,
        user: null,
        accessToken: null,
        isAuthenticated: false,
      });
      saveAccessToken(null);
      throw httpError;
    }
  },

  logout: async () => {
    set({ isLoading: true, error: null });
    try {
      await authService.logout();
    } catch {
      // do not block local logout on API failure
    }

    saveAccessToken(null);
    set({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
    });
  },
}));
