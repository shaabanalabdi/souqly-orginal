import axios from 'axios';
import i18n from '../i18n';

const baseURL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

export const http = axios.create({
  baseURL,
  withCredentials: true,
});

http.interceptors.request.use((config) => {
  const lang = i18n.resolvedLanguage ?? localStorage.getItem('souqly_lang') ?? 'ar';
  config.headers['Accept-Language'] = lang;
  return config;
});

export function setAuthToken(token: string | null): void {
  if (token) {
    http.defaults.headers.common.Authorization = `Bearer ${token}`;
    return;
  }

  delete http.defaults.headers.common.Authorization;
}

export class HttpError extends Error {
  public readonly status?: number;
  public readonly code?: string;
  public readonly details?: unknown;

  public constructor(message: string, status?: number, code?: string, details?: unknown) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function asHttpError(error: unknown): HttpError {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const payload = error.response?.data as
      | {
          error?: { code?: string; message?: string; details?: unknown };
          message?: string;
        }
      | undefined;
    const code = payload?.error?.code;
    const message =
      payload?.error?.message ??
      payload?.message ??
      error.message ??
      'Unexpected network error';

    return new HttpError(message, status, code, payload?.error?.details);
  }

  if (error instanceof HttpError) {
    return error;
  }

  if (error instanceof Error) {
    return new HttpError(error.message);
  }

  return new HttpError('Unexpected error');
}
