import { runListingExpirationSweep } from '../../modules/listings/listing.service.js';
import { logger } from '../utils/logger.js';

const DEFAULT_SWEEP_INTERVAL_MS = 15 * 60 * 1000;

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

export function startListingExpirationScheduler(): () => void {
    const enabled = (process.env.LISTING_EXPIRATION_SWEEP_ENABLED ?? 'true').toLowerCase() !== 'false';
    if (!enabled) {
        logger.info('Listing expiration scheduler disabled');
        return () => undefined;
    }

    const intervalMs = parsePositiveInt(
        process.env.LISTING_EXPIRATION_SWEEP_MS,
        DEFAULT_SWEEP_INTERVAL_MS,
    );

    let running = false;
    const tick = async (): Promise<void> => {
        if (running) {
            return;
        }

        running = true;
        try {
            const result = await runListingExpirationSweep();
            if (result.expiredCount > 0) {
                logger.info(`Listing expiration sweep completed: expired=${result.expiredCount}`);
            }
        } catch (error) {
            logger.error('Listing expiration sweep failed:', error);
        } finally {
            running = false;
        }
    };

    void tick();
    const timer = setInterval(() => {
        void tick();
    }, intervalMs);

    logger.info(`Listing expiration scheduler started (${intervalMs}ms interval)`);

    return () => {
        clearInterval(timer);
    };
}
