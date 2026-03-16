const DIALECT_GROUPS: string[][] = [
    ['موبايل', 'موبيل', 'جوال', 'تلفون', 'هاتف', 'محمول', 'mobile', 'phone', 'cellphone'],
    ['سيارة', 'عربية', 'مركبة', 'car', 'auto', 'vehicle'],
    ['شقة', 'بيت', 'منزل', 'دار', 'apartment', 'flat', 'home'],
    ['لابتوب', 'لاب', 'كمبيوتر محمول', 'حاسوب محمول', 'laptop', 'notebook'],
    ['دراجة', 'دراجة نارية', 'موتور', 'موتوسيكل', 'bike', 'motorcycle'],
];

function normalizeArabic(text: string): string {
    return text
        .toLowerCase()
        .replace(/[\u064B-\u065F\u0670]/g, '')
        .replace(/\u0640/g, '')
        .replace(/[أإآٱ]/g, 'ا')
        .replace(/ى/g, 'ي')
        .replace(/\s+/g, ' ')
        .trim();
}

function tokenize(text: string): string[] {
    return text
        .split(/[\s,،.;:/\\|_-]+/)
        .map((token) => token.trim())
        .filter(Boolean);
}

const DIALECT_MAP = DIALECT_GROUPS.reduce<Map<string, Set<string>>>((map, group) => {
    const expanded = new Set<string>();
    for (const term of group) {
        expanded.add(term);
        expanded.add(normalizeArabic(term));
    }

    for (const term of group) {
        map.set(term, expanded);
        map.set(normalizeArabic(term), expanded);
    }

    return map;
}, new Map());

function pushUnique(target: string[], seen: Set<string>, value: string): void {
    const trimmed = value.trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    target.push(trimmed);
}

export function expandDialectSearchTerms(query: string): string[] {
    const raw = query.trim();
    if (!raw) return [];

    const terms: string[] = [];
    const seen = new Set<string>();

    const normalizedQuery = normalizeArabic(raw);

    pushUnique(terms, seen, raw);
    pushUnique(terms, seen, normalizedQuery);

    const tokens = Array.from(new Set([...tokenize(raw), ...tokenize(normalizedQuery)]));
    for (const token of tokens) {
        const aliases = DIALECT_MAP.get(token);
        if (!aliases) continue;
        for (const alias of aliases) {
            pushUnique(terms, seen, alias);
        }
    }

    return terms.slice(0, 20);
}
