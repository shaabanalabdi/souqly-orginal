import 'dotenv/config';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import app from './app.js';
import { registerDomainEventHandlers } from './events/registerDomainEventHandlers.js';
import { setupChatSocket } from './modules/chats/chat.socket.js';
import { closeQueues, initializeQueues } from './queues/queueManager.js';
import { startListingExpirationScheduler } from './shared/jobs/listingExpiration.job.js';
import { startSavedSearchDigestScheduler } from './shared/jobs/savedSearchDigest.job.js';
import { getAllowedOrigins } from './shared/config/origins.js';
import { ensureBootstrapAdmin } from './shared/startup/bootstrapAdmin.js';
import { logger } from './shared/utils/logger.js';
import { prisma } from './shared/utils/prisma.js';
import { redis } from './shared/utils/redis.js';

const PORT = parseInt(process.env.PORT || '5000', 10);
const allowedOrigins = getAllowedOrigins();

async function listenWithFallback(httpServer: ReturnType<typeof createServer>, preferredPort: number): Promise<number> {
    const isProduction = process.env.NODE_ENV === 'production';
    const candidatePorts = isProduction
        ? [preferredPort]
        : [preferredPort, preferredPort + 1, preferredPort + 2];

    for (const port of candidatePorts) {
        try {
            await new Promise<void>((resolve, reject) => {
                const onListening = (): void => {
                    httpServer.off('error', onError);
                    resolve();
                };

                const onError = (error: NodeJS.ErrnoException): void => {
                    httpServer.off('listening', onListening);
                    reject(error);
                };

                httpServer.once('listening', onListening);
                httpServer.once('error', onError);
                httpServer.listen(port);
            });

            return port;
        } catch (error) {
            const nodeError = error as NodeJS.ErrnoException;
            if (nodeError.code !== 'EADDRINUSE' || port === candidatePorts[candidatePorts.length - 1]) {
                throw error;
            }

            logger.warn(`Port ${port} is already in use, trying ${port + 1}...`);
        }
    }

    throw new Error('No available port found.');
}

async function bootstrap(): Promise<void> {
    try {
        await prisma.$connect();
    logger.info('MySQL connected');

        // Keep local/dev environments always able to login.
        await ensureBootstrapAdmin();

        await redis.ping();
        logger.info('Redis connected');

        const httpServer = createServer(app);

        const io = new SocketServer(httpServer, {
            cors: {
                origin: allowedOrigins,
                credentials: true,
            },
        });

        setupChatSocket(io);
        app.set('io', io);
        await initializeQueues({ io });
        registerDomainEventHandlers();

        const stopListingExpirationScheduler = startListingExpirationScheduler();
        const stopSavedSearchDigestScheduler = startSavedSearchDigestScheduler(io);

        const activePort = await listenWithFallback(httpServer, PORT);
        logger.info(`Souqly API running on port ${activePort}`);
        logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
        logger.info(`Health: http://localhost:${activePort}/api/v1/health`);

        const shutdown = async (signal: string): Promise<void> => {
            stopListingExpirationScheduler();
            stopSavedSearchDigestScheduler();
            logger.info(`${signal} received, shutting down...`);

            httpServer.close(async () => {
                await closeQueues();
                await prisma.$disconnect();
                redis.disconnect();
                logger.info('Server shut down');
                process.exit(0);
            });

            setTimeout(() => {
                logger.error('Forced shutdown after 10s timeout');
                process.exit(1);
            }, 10000);
        };

        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
}

bootstrap();
