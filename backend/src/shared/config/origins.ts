const DEFAULT_ALLOWED_ORIGINS = [
    'http://localhost',
    'http://127.0.0.1',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
];

function normalizeOrigin(origin: string): string {
    return origin.trim().toLowerCase().replace(/\/+$/, '');
}

function splitOrigins(rawValue: string | undefined): string[] {
    if (!rawValue) return [];
    return rawValue
        .split(',')
        .map((value) => normalizeOrigin(value))
        .filter((value) => value.length > 0);
}

export function getAllowedOrigins(): string[] {
    const configured = [
        ...splitOrigins(process.env.FRONTEND_URLS),
        ...splitOrigins(process.env.FRONTEND_URL),
    ];

    const merged = [...DEFAULT_ALLOWED_ORIGINS, ...configured].map((value) => normalizeOrigin(value));
    return Array.from(new Set(merged));
}

export function isAllowedOrigin(origin: string | undefined, allowedOrigins: string[]): boolean {
    if (!origin) return true;
    return allowedOrigins.includes(normalizeOrigin(origin));
}
