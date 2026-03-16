import type { Request } from 'express';

export type AppLanguage = 'ar' | 'en';

const DEFAULT_LANGUAGE: AppLanguage = 'ar';

function parseLanguage(value: unknown): AppLanguage | null {
    if (Array.isArray(value)) {
        return parseLanguage(value[0]);
    }

    if (typeof value !== 'string') {
        return null;
    }

    const [firstToken] = value.split(',');
    const normalized = firstToken.trim().toLowerCase().replace('_', '-');

    if (normalized.startsWith('ar')) {
        return 'ar';
    }

    if (normalized.startsWith('en')) {
        return 'en';
    }

    return null;
}

export function normalizeLanguage(value: unknown): AppLanguage {
    return parseLanguage(value) ?? DEFAULT_LANGUAGE;
}

export function getRequestLanguage(req: Request): AppLanguage {
    const queryLanguage = parseLanguage(req.query.lang);
    if (queryLanguage) {
        return queryLanguage;
    }

    return parseLanguage(req.headers['accept-language']) ?? DEFAULT_LANGUAGE;
}
