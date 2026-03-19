import xss from 'xss';

function normalizeWhitespace(value: string): string {
    return value.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').trim();
}

export function sanitizeText(value: string): string {
    return normalizeWhitespace(xss(value));
}

export function sanitizeNullableText(value: string | null | undefined): string | null {
    if (value === undefined || value === null) {
        return null;
    }

    const sanitized = sanitizeText(value);
    return sanitized.length > 0 ? sanitized : null;
}

export function sanitizeStringArray(values: string[] | undefined): string[] {
    if (!values) {
        return [];
    }

    return Array.from(
        new Set(
            values
                .map((value) => sanitizeText(value))
                .filter((value) => value.length > 0),
        ),
    );
}
