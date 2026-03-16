// FILE: backend/src/shared/utils/redis.ts

import Redis from 'ioredis';
import { logger } from './logger.js';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

export const redis = new Redis(REDIS_URL, {
    retryStrategy: (times: number) => {
        if (times > 3) {
            logger.error('Redis: max retries reached');
            return null;
        }
        return Math.min(times * 200, 2000);
    },
    lazyConnect: true,
    maxRetriesPerRequest: 3,
});

redis.on('connect', () => logger.info('Redis: connected'));
redis.on('error', (err) => logger.error('Redis error:', err));

/** Get cached value or fetch + cache it */
export async function cacheGetOrSet<T>(
    key: string,
    ttlSeconds: number,
    fetcher: () => Promise<T>,
): Promise<T> {
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached) as T;
    const data = await fetcher();
    await redis.setex(key, ttlSeconds, JSON.stringify(data));
    return data;
}

/** Delete keys matching a pattern */
export async function cacheInvalidate(pattern: string): Promise<void> {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) await redis.del(...keys);
}
