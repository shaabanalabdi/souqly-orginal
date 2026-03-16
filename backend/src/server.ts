// FILE: backend/src/server.ts

import 'dotenv/config';
import app from './app.js';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { prisma } from './shared/utils/prisma.js';
import { redis } from './shared/utils/redis.js';
import { logger } from './shared/utils/logger.js';
import { setupChatSocket } from './modules/chats/chat.socket.js';
import { startSavedSearchDigestScheduler } from './shared/jobs/savedSearchDigest.job.js';

const PORT = parseInt(process.env.PORT || '5000', 10);

async function bootstrap(): Promise<void> {
    try {
        // Test DB
        await prisma.$connect();
        logger.info('✅ MySQL connected');

        // Test Redis
        await redis.ping();
        logger.info('✅ Redis connected');

        // Create HTTP server
        const httpServer = createServer(app);

        // Socket.IO
        const io = new SocketServer(httpServer, {
            cors: {
                origin: process.env.FRONTEND_URL || 'http://localhost:5173',
                credentials: true,
            },
        });

        setupChatSocket(io);

        // Make io accessible to routes
        app.set('io', io);
        const stopSavedSearchDigestScheduler = startSavedSearchDigestScheduler(io);

        // Start listening
        httpServer.listen(PORT, () => {
            logger.info(`🚀 Souqly API running on port ${PORT}`);
            logger.info(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
            logger.info(`🔗 http://localhost:${PORT}/api/v1/health`);
        });

        // Graceful shutdown
        const shutdown = async (signal: string): Promise<void> => {
            stopSavedSearchDigestScheduler();
            logger.info(`${signal} received — shutting down...`);
            httpServer.close(async () => {
                await prisma.$disconnect();
                redis.disconnect();
                logger.info('👋 Server shut down');
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
        logger.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

bootstrap();
