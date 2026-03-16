import { buildPaginationMeta, getSkip, parsePagination } from '../utils/pagination.js';
import { redis } from '../utils/redis.js';

const BLACKLIST_ENTRIES_KEY = 'moderation:blacklist:entries';
const BLACKLIST_SEQ_KEY = 'moderation:blacklist:seq';
const BLACKLIST_TYPE_INDEX_PREFIX = 'moderation:blacklist:index:type:';
const BLACKLIST_VALUE_INDEX_KEY = 'moderation:blacklist:index:value';

export type BlacklistEntryType = 'phone' | 'ip' | 'keyword';

export interface BlacklistEntry {
    id: string;
    type: BlacklistEntryType;
    value: string;
    normalizedValue: string;
    reason: string | null;
    isActive: boolean;
    createdBy: number;
    updatedBy: number;
    createdAt: string;
    updatedAt: string;
}

export interface ListBlacklistQuery {
    page?: number;
    limit?: number;
    type?: BlacklistEntryType;
    q?: string;
    active?: boolean;
}

function isBlacklistType(value: string): value is BlacklistEntryType {
    return value === 'phone' || value === 'ip' || value === 'keyword';
}

function typeIndexKey(type: BlacklistEntryType): string {
    return `${BLACKLIST_TYPE_INDEX_PREFIX}${type}`;
}

function normalizePhone(raw: string): string {
    const trimmed = raw.trim();
    const hasPlusPrefix = trimmed.startsWith('+');
    const digits = trimmed.replace(/[^\d]/g, '');
    return `${hasPlusPrefix ? '+' : ''}${digits}`;
}

function normalizeValue(type: BlacklistEntryType, value: string): string {
    if (type === 'phone') {
        return normalizePhone(value);
    }

    return value.trim().toLowerCase();
}

function valueIndexKey(type: BlacklistEntryType, normalizedValue: string): string {
    return `${type}:${normalizedValue}`;
}

function parseEntry(raw: string | null): BlacklistEntry | null {
    if (!raw) {
        return null;
    }

    try {
        const parsed = JSON.parse(raw) as BlacklistEntry;
        if (!parsed || !parsed.id || !isBlacklistType(parsed.type) || !parsed.value) {
            return null;
        }

        return parsed;
    } catch {
        return null;
    }
}

async function getEntryById(id: string): Promise<BlacklistEntry | null> {
    return parseEntry(await redis.hget(BLACKLIST_ENTRIES_KEY, id));
}

export async function listBlacklistEntries(query: ListBlacklistQuery): Promise<{
    items: BlacklistEntry[];
    meta: ReturnType<typeof buildPaginationMeta>;
}> {
    const pagination = parsePagination(query as unknown as Record<string, unknown>);
    const rawEntries = await redis.hvals(BLACKLIST_ENTRIES_KEY);
    const parsed = rawEntries
        .map((raw) => parseEntry(raw))
        .filter((entry): entry is BlacklistEntry => entry !== null);

    const q = query.q?.trim().toLowerCase();
    const filtered = parsed.filter((entry) => {
        if (query.type && entry.type !== query.type) {
            return false;
        }
        if (query.active !== undefined && entry.isActive !== query.active) {
            return false;
        }
        if (q && !entry.value.toLowerCase().includes(q) && !(entry.reason ?? '').toLowerCase().includes(q)) {
            return false;
        }

        return true;
    });

    const sorted = filtered.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    return {
        items: sorted.slice(getSkip(pagination), getSkip(pagination) + pagination.limit),
        meta: buildPaginationMeta(sorted.length, pagination),
    };
}

export async function createBlacklistEntry(input: {
    type: BlacklistEntryType;
    value: string;
    reason?: string;
    adminId: number;
}): Promise<BlacklistEntry> {
    const normalizedValue = normalizeValue(input.type, input.value);
    const dedupeId = await redis.hget(BLACKLIST_VALUE_INDEX_KEY, valueIndexKey(input.type, normalizedValue));
    if (dedupeId) {
        const existing = await getEntryById(dedupeId);
        if (existing && existing.isActive) {
            throw new Error('BLACKLIST_ENTRY_ALREADY_EXISTS');
        }
    }

    const now = new Date().toISOString();
    const id = String(await redis.incr(BLACKLIST_SEQ_KEY));

    const entry: BlacklistEntry = {
        id,
        type: input.type,
        value: input.value.trim(),
        normalizedValue,
        reason: input.reason?.trim() || null,
        isActive: true,
        createdBy: input.adminId,
        updatedBy: input.adminId,
        createdAt: now,
        updatedAt: now,
    };

    await redis
        .multi()
        .hset(BLACKLIST_ENTRIES_KEY, id, JSON.stringify(entry))
        .sadd(typeIndexKey(entry.type), id)
        .hset(BLACKLIST_VALUE_INDEX_KEY, valueIndexKey(entry.type, entry.normalizedValue), id)
        .exec();

    return entry;
}

export async function updateBlacklistEntry(input: {
    id: string;
    reason?: string;
    isActive?: boolean;
    adminId: number;
}): Promise<BlacklistEntry | null> {
    const existing = await getEntryById(input.id);
    if (!existing) {
        return null;
    }

    const updated: BlacklistEntry = {
        ...existing,
        reason: input.reason !== undefined ? (input.reason.trim() || null) : existing.reason,
        isActive: input.isActive ?? existing.isActive,
        updatedBy: input.adminId,
        updatedAt: new Date().toISOString(),
    };

    await redis.hset(BLACKLIST_ENTRIES_KEY, existing.id, JSON.stringify(updated));
    return updated;
}

export async function deleteBlacklistEntry(id: string): Promise<boolean> {
    const existing = await getEntryById(id);
    if (!existing) {
        return false;
    }

    await redis
        .multi()
        .hdel(BLACKLIST_ENTRIES_KEY, id)
        .srem(typeIndexKey(existing.type), id)
        .hdel(BLACKLIST_VALUE_INDEX_KEY, valueIndexKey(existing.type, existing.normalizedValue))
        .exec();

    return true;
}

export async function isBlockedValue(type: BlacklistEntryType, value: string | null | undefined): Promise<boolean> {
    if (!value || !value.trim()) {
        return false;
    }

    const normalizedValue = normalizeValue(type, value);
    const entryId = await redis.hget(BLACKLIST_VALUE_INDEX_KEY, valueIndexKey(type, normalizedValue));
    if (!entryId) {
        return false;
    }

    const entry = await getEntryById(entryId);
    return Boolean(entry?.isActive);
}

export async function matchBlockedKeywords(text: string): Promise<string[]> {
    const keywordIds = await redis.smembers(typeIndexKey('keyword'));
    if (keywordIds.length === 0) {
        return [];
    }

    const keywordEntriesRaw = await redis.hmget(BLACKLIST_ENTRIES_KEY, ...keywordIds);
    const normalizedText = text.toLowerCase();
    const matches = keywordEntriesRaw
        .map((raw) => parseEntry(raw))
        .filter((entry): entry is BlacklistEntry => Boolean(entry && entry.type === 'keyword' && entry.isActive))
        .filter((entry) => normalizedText.includes(entry.normalizedValue))
        .map((entry) => entry.value);

    return Array.from(new Set(matches));
}
