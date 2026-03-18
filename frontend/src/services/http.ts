import axios from 'axios';
import type { AxiosRequestConfig } from 'axios';
import i18n from '../i18n';

const LOCAL_API_PORT_CANDIDATES = [5000, 5001, 5002];

function resolveApiBaseUrl(): string {
  const explicitBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
  if (explicitBaseUrl) {
    return explicitBaseUrl;
  }

  const { protocol, hostname } = window.location;
  const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1';

  if (isLocalHost) {
    return `${protocol}//${hostname}:5000/api/v1`;
  }

  return '/api/v1';
}

const baseURL = resolveApiBaseUrl();

export const http = axios.create({
  baseURL,
  withCredentials: true,
});

export function getApiBaseUrl(): string {
  return String(http.defaults.baseURL ?? baseURL);
}

function isLocalEnvironment(): boolean {
  const { hostname } = window.location;
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

function buildLocalCandidateBaseUrls(): string[] {
  const { protocol, hostname } = window.location;
  return LOCAL_API_PORT_CANDIDATES.map((port) => `${protocol}//${hostname}:${port}/api/v1`);
}

async function detectHealthyLocalBaseUrl(currentBaseUrl: string): Promise<string | null> {
  if (!isLocalEnvironment()) {
    return null;
  }

  const candidates = buildLocalCandidateBaseUrls()
    .filter((candidate) => candidate !== currentBaseUrl);

  for (const candidate of candidates) {
    try {
      const healthResponse = await axios.get(`${candidate}/health`, {
        timeout: 1200,
        withCredentials: true,
      });

      if (healthResponse.status >= 200 && healthResponse.status < 300) {
        return candidate;
      }
    } catch {
      // try next candidate
    }
  }

  return null;
}

http.interceptors.request.use((config) => {
  const lang = i18n.resolvedLanguage ?? localStorage.getItem('souqly_lang') ?? 'ar';
  config.headers['Accept-Language'] = lang;
  return config;
});

http.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (!axios.isAxiosError(error) || !error.config) {
      return Promise.reject(error);
    }

    const requestConfig = error.config as AxiosRequestConfig & { __souqlyBaseRetried?: boolean };
    if (requestConfig.__souqlyBaseRetried) {
      return Promise.reject(error);
    }

    const shouldRetryWithFallbackBase =
      !error.response
      || error.response.status === 404
      || error.response.status === 502
      || error.response.status === 503
      || error.response.status === 504;

    if (!shouldRetryWithFallbackBase) {
      return Promise.reject(error);
    }

    const currentBaseUrl = String(requestConfig.baseURL ?? getApiBaseUrl());
    const fallbackBaseUrl = await detectHealthyLocalBaseUrl(currentBaseUrl);

    if (!fallbackBaseUrl) {
      return Promise.reject(error);
    }

    requestConfig.__souqlyBaseRetried = true;
    requestConfig.baseURL = fallbackBaseUrl;
    http.defaults.baseURL = fallbackBaseUrl;
    return http.request(requestConfig);
  },
);

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

export async function checkApiHealth(): Promise<boolean> {
  try {
    await http.get('/health', { timeout: 1500 });
    return true;
  } catch {
    return false;
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
