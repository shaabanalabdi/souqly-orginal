import type { Server as SocketServer } from 'socket.io';
import { dispatchSavedSearchDigest, type DigestFrequency } from '../../modules/preferences/savedSearchDigest.service.js';
import { buildPaginationMeta, getSkip, parsePagination } from '../utils/pagination.js';
import { redis } from '../utils/redis.js';
import { logger } from '../utils/logger.js';

const LAST_RUN_KEY_PREFIX = 'jobs:saved-search-digest:last:';
const LOCK_KEY_PREFIX = 'jobs:saved-search-digest:lock:';
const HISTORY_KEY = 'jobs:saved-search-digest:history';
const DEFAULT_CHECK_INTERVAL_MS = 60 * 60 * 1000;
const DEFAULT_HISTORY_MAX_ITEMS = 250;

function parsePositiveInt(raw: string | undefined, fallback: number): number {
    if (!raw) {
        return fallback;
    }

    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return fallback;
    }

    return Math.floor(parsed);
}

function parseTimestamp(value: string | undefined): number | undefined {
    if (!value) {
        return undefined;
    }

    const parsed = Date.parse(value);
    if (!Number.isFinite(parsed)) {
        return undefined;
    }

    return parsed;
}

function computeDurationMs(startedAt: string, completedAt: string): number {
    const startedMs = Date.parse(startedAt);
    const completedMs = Date.parse(completedAt);
    if (!Number.isFinite(startedMs) || !Number.isFinite(completedMs)) {
        return 0;
    }

    return Math.max(0, Math.floor(completedMs - startedMs));
}

function minIntervalMs(frequency: DigestFrequency): number {
    return frequency === 'daily' ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
}

function getLastRunKey(frequency: DigestFrequency): string {
    return `${LAST_RUN_KEY_PREFIX}${frequency}`;
}

function getLockKey(frequency: DigestFrequency): string {
    return `${LOCK_KEY_PREFIX}${frequency}`;
}

async function acquireFrequencyLock(frequency: DigestFrequency, lockTtlSeconds = 300): Promise<boolean> {
    const lockResult = await redis.set(getLockKey(frequency), new Date().toISOString(), 'EX', lockTtlSeconds, 'NX');
    return lockResult === 'OK';
}

async function releaseFrequencyLock(frequency: DigestFrequency): Promise<void> {
    await redis.del(getLockKey(frequency));
}

async function readLastRunIso(frequency: DigestFrequency): Promise<string | null> {
    return redis.get(getLastRunKey(frequency));
}

async function writeLastRunIso(frequency: DigestFrequency, isoDate: string): Promise<void> {
    await redis.set(getLastRunKey(frequency), isoDate);
}

async function runDigestIfDue(frequency: DigestFrequency, io: SocketServer): Promise<void> {
    const lockTtlSeconds = 300;
    const locked = await acquireFrequencyLock(frequency, lockTtlSeconds);
    if (!locked) {
        return;
    }

    try {
        const now = Date.now();
        const lastRun = await readLastRunIso(frequency);
        if (lastRun) {
            const lastRunMs = Date.parse(lastRun);
            if (Number.isFinite(lastRunMs) && now - lastRunMs < minIntervalMs(frequency)) {
                return;
            }
        }

        const result = await dispatchSavedSearchDigest(frequency, io);
        await writeLastRunIso(frequency, result.completedAt);
        await appendHistoryEntry(createHistoryEntry('scheduler', result));
        logger.info(
            `Saved-search ${frequency} digest completed: searches=${result.processedSearches}, matched=${result.matchedSearches}, users=${result.notifiedUsers}`,
        );
    } catch (error) {
        logger.error(`Saved-search ${frequency} digest failed:`, error);
    } finally {
        await releaseFrequencyLock(frequency);
    }
}

interface DigestFrequencyStatus {
    lastRunAt: string | null;
    nextDueAt: string;
    isLocked: boolean;
    minIntervalMs: number;
}

export interface SavedSearchDigestStatus {
    enabled: boolean;
    checkIntervalMs: number;
    daily: DigestFrequencyStatus;
    weekly: DigestFrequencyStatus;
}

function buildDigestFrequencyStatus(
    frequency: DigestFrequency,
    lastRunAt: string | null,
    isLocked: boolean,
): DigestFrequencyStatus {
    const intervalMs = minIntervalMs(frequency);
    const lastRunMs = lastRunAt ? Date.parse(lastRunAt) : NaN;
    const nextDueMs = Number.isFinite(lastRunMs) ? lastRunMs + intervalMs : Date.now();

    return {
        lastRunAt,
        nextDueAt: new Date(nextDueMs).toISOString(),
        isLocked,
        minIntervalMs: intervalMs,
    };
}

export async function getSavedSearchDigestStatus(): Promise<SavedSearchDigestStatus> {
    const enabled = (process.env.SAVED_SEARCH_DIGEST_ENABLED ?? 'true').toLowerCase() !== 'false';
    const checkIntervalMs = parsePositiveInt(process.env.SAVED_SEARCH_DIGEST_CHECK_MS, DEFAULT_CHECK_INTERVAL_MS);

    const [dailyLastRunAt, weeklyLastRunAt, dailyLockedRaw, weeklyLockedRaw] = await Promise.all([
        readLastRunIso('daily'),
        readLastRunIso('weekly'),
        redis.exists(getLockKey('daily')),
        redis.exists(getLockKey('weekly')),
    ]);

    return {
        enabled,
        checkIntervalMs,
        daily: buildDigestFrequencyStatus('daily', dailyLastRunAt, dailyLockedRaw > 0),
        weekly: buildDigestFrequencyStatus('weekly', weeklyLastRunAt, weeklyLockedRaw > 0),
    };
}

export type DigestRunMode = 'daily' | 'weekly' | 'both';

interface SkippedDigestRun {
    frequency: DigestFrequency;
    reason: 'LOCKED' | 'ERROR';
    message?: string;
}

export interface SavedSearchDigestManualRunResult {
    triggeredAt: string;
    frequency: DigestRunMode;
    runs: Awaited<ReturnType<typeof dispatchSavedSearchDigest>>[];
    skipped: SkippedDigestRun[];
}

export type DigestHistorySource = 'scheduler' | 'manual';
export type DigestHistorySort = 'completed_desc' | 'completed_asc' | 'duration_desc' | 'duration_asc';

export interface SavedSearchDigestHistoryEntry {
    id: string;
    source: DigestHistorySource;
    frequency: DigestFrequency;
    processedSearches: number;
    matchedSearches: number;
    matchedListings: number;
    notifiedUsers: number;
    emailedUsers: number;
    startedAt: string;
    completedAt: string;
    durationMs: number;
    recordedAt: string;
}

function historyMaxItems(): number {
    return parsePositiveInt(process.env.SAVED_SEARCH_DIGEST_HISTORY_MAX_ITEMS, DEFAULT_HISTORY_MAX_ITEMS);
}

function createHistoryEntry(
    source: DigestHistorySource,
    run: Awaited<ReturnType<typeof dispatchSavedSearchDigest>>,
): SavedSearchDigestHistoryEntry {
    return {
        id: `${source}:${run.frequency}:${run.completedAt}:${Math.random().toString(36).slice(2, 8)}`,
        source,
        frequency: run.frequency,
        processedSearches: run.processedSearches,
        matchedSearches: run.matchedSearches,
        matchedListings: run.matchedListings,
        notifiedUsers: run.notifiedUsers,
        emailedUsers: run.emailedUsers,
        startedAt: run.startedAt,
        completedAt: run.completedAt,
        durationMs: computeDurationMs(run.startedAt, run.completedAt),
        recordedAt: new Date().toISOString(),
    };
}

async function appendHistoryEntry(entry: SavedSearchDigestHistoryEntry): Promise<void> {
    await redis.lpush(HISTORY_KEY, JSON.stringify(entry));
    await redis.ltrim(HISTORY_KEY, 0, Math.max(1, historyMaxItems()) - 1);
}

export async function runSavedSearchDigestNow(
    frequency: DigestRunMode,
    io: SocketServer | null,
): Promise<SavedSearchDigestManualRunResult> {
    const frequencies: DigestFrequency[] = frequency === 'both' ? ['daily', 'weekly'] : [frequency];
    const runs: Awaited<ReturnType<typeof dispatchSavedSearchDigest>>[] = [];
    const skipped: SkippedDigestRun[] = [];

    for (const currentFrequency of frequencies) {
        const locked = await acquireFrequencyLock(currentFrequency);
        if (!locked) {
            skipped.push({
                frequency: currentFrequency,
                reason: 'LOCKED',
            });
            continue;
        }

        try {
            const result = await dispatchSavedSearchDigest(currentFrequency, io);
            runs.push(result);
            await writeLastRunIso(currentFrequency, result.completedAt);
            await appendHistoryEntry(createHistoryEntry('manual', result));
        } catch (error) {
            skipped.push({
                frequency: currentFrequency,
                reason: 'ERROR',
                message: error instanceof Error ? error.message : 'Unknown digest error',
            });
            logger.error(`Manual saved-search ${currentFrequency} digest failed:`, error);
        } finally {
            await releaseFrequencyLock(currentFrequency);
        }
    }

    return {
        triggeredAt: new Date().toISOString(),
        frequency,
        runs,
        skipped,
    };
}

export async function getSavedSearchDigestHistory(query: {
    page?: number;
    limit?: number;
    frequency?: DigestFrequency;
    source?: DigestHistorySource;
    from?: string;
    to?: string;
    sort?: DigestHistorySort;
    minDurationMs?: number;
    maxDurationMs?: number;
}): Promise<{ items: SavedSearchDigestHistoryEntry[]; meta: ReturnType<typeof buildPaginationMeta> }> {
    const pagination = parsePagination(query as unknown as Record<string, unknown>);
    const rawEntries = await redis.lrange(HISTORY_KEY, 0, Math.max(200, historyMaxItems()));
    const fromMs = parseTimestamp(query.from);
    const toMs = parseTimestamp(query.to);
    const minDurationMs = Number.isFinite(query.minDurationMs)
        ? Math.max(0, Math.floor(Number(query.minDurationMs)))
        : undefined;
    const maxDurationMs = Number.isFinite(query.maxDurationMs)
        ? Math.max(0, Math.floor(Number(query.maxDurationMs)))
        : undefined;

    const parsedEntries: SavedSearchDigestHistoryEntry[] = [];
    for (const raw of rawEntries) {
        try {
            const parsed = JSON.parse(raw) as SavedSearchDigestHistoryEntry;
            if (!parsed || !parsed.id || !parsed.frequency || !parsed.source) {
                continue;
            }

            const normalizedDurationMs = Number.isFinite(parsed.durationMs) && parsed.durationMs >= 0
                ? Math.floor(parsed.durationMs)
                : computeDurationMs(parsed.startedAt, parsed.completedAt);

            parsedEntries.push({
                ...parsed,
                durationMs: normalizedDurationMs,
            });
        } catch {
            continue;
        }
    }

    const filtered = parsedEntries.filter((entry) => {
        if (query.frequency && entry.frequency !== query.frequency) {
            return false;
        }
        if (query.source && entry.source !== query.source) {
            return false;
        }
        if (fromMs !== undefined || toMs !== undefined) {
            const completedMs = Date.parse(entry.completedAt);
            if (!Number.isFinite(completedMs)) {
                return false;
            }

            if (fromMs !== undefined && completedMs < fromMs) {
                return false;
            }
            if (toMs !== undefined && completedMs > toMs) {
                return false;
            }
        }
        if (minDurationMs !== undefined && entry.durationMs < minDurationMs) {
            return false;
        }
        if (maxDurationMs !== undefined && entry.durationMs > maxDurationMs) {
            return false;
        }
        return true;
    });

    const sorted = [...filtered].sort((a, b) => {
        const aMs = Date.parse(a.completedAt);
        const bMs = Date.parse(b.completedAt);
        const safeAMs = Number.isFinite(aMs) ? aMs : 0;
        const safeBMs = Number.isFinite(bMs) ? bMs : 0;

        if (query.sort === 'duration_asc' || query.sort === 'duration_desc') {
            const durationDelta = a.durationMs - b.durationMs;
            if (durationDelta !== 0) {
                return query.sort === 'duration_asc' ? durationDelta : -durationDelta;
            }

            // Stable tie-breaker for same duration.
            return safeBMs - safeAMs;
        }

        if (query.sort === 'completed_asc') {
            return safeAMs - safeBMs;
        }

        return safeBMs - safeAMs;
    });

    return {
        items: sorted.slice(getSkip(pagination), getSkip(pagination) + pagination.limit),
        meta: buildPaginationMeta(sorted.length, pagination),
    };
}

export function startSavedSearchDigestScheduler(io: SocketServer): () => void {
    const enabled = (process.env.SAVED_SEARCH_DIGEST_ENABLED ?? 'true').toLowerCase() !== 'false';
    if (!enabled) {
        logger.info('Saved-search digest scheduler disabled');
        return () => undefined;
    }

    const checkIntervalMs = parsePositiveInt(process.env.SAVED_SEARCH_DIGEST_CHECK_MS, DEFAULT_CHECK_INTERVAL_MS);
    let running = false;

    const tick = async (): Promise<void> => {
        if (running) {
            return;
        }

        running = true;
        try {
            await runDigestIfDue('daily', io);
            await runDigestIfDue('weekly', io);
        } finally {
            running = false;
        }
    };

    logger.info(`Saved-search digest scheduler started (check every ${checkIntervalMs}ms)`);
    void tick();
    const intervalId = setInterval(() => {
        void tick();
    }, checkIntervalMs);

    return () => {
        clearInterval(intervalId);
        logger.info('Saved-search digest scheduler stopped');
    };
}
