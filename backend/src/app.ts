import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import authRoutes from './modules/auth/auth.routes.js';
import userRoutes from './modules/users/user.routes.js';
import geoRoutes from './modules/geo/geo.routes.js';
import categoryRoutes from './modules/categories/category.routes.js';
import listingRoutes from './modules/listings/listing.routes.js';
import preferenceRoutes from './modules/preferences/preference.routes.js';
import chatRoutes from './modules/chats/chat.routes.js';
import dealRoutes from './modules/deals/deal.routes.js';
import { escrowWebhookController } from './modules/deals/deal.controller.js';
import { escrowWebhookBodySchema } from './modules/deals/deal.validation.js';
import adminRoutes from './modules/admin/admin.routes.js';
import reportRoutes from './modules/reports/report.routes.js';
import mediaRoutes from './modules/media/media.routes.js';
import notificationRoutes from './modules/notifications/notification.routes.js';
import verificationRoutes from './modules/verification/verification.routes.js';
import subscriptionRoutes from './modules/subscriptions/subscription.routes.js';
import businessProfileRoutes from './modules/businessProfiles/businessProfile.routes.js';
import craftsmanProfileRoutes from './modules/craftsmanProfiles/craftsmanProfile.routes.js';
import { errorHandler } from './shared/middleware/errorHandler.js';
import { globalRateLimiter } from './shared/middleware/rateLimiter.js';
import { validate } from './shared/middleware/validate.js';
import { getAllowedOrigins, isAllowedOrigin } from './shared/config/origins.js';

const app = express();
const allowedOrigins = getAllowedOrigins();

// Security
app.use(helmet());
app.use(
    cors({
        origin: (origin, callback) => {
            callback(null, isAllowedOrigin(origin, allowedOrigins));
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: [
            'Content-Type',
            'Authorization',
            'Accept-Language',
            'x-csrf-token',
            'x-idempotency-key',
        ],
    }),
);

// Parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Rate limiting
app.use(globalRateLimiter);

// Health check
app.get('/api/v1/health', (_req, res) => {
    res.json({
        success: true,
        data: {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
        },
    });
});

// Public webhook routes
app.post(
    '/api/v1/payments/escrow/webhook',
    validate({ body: escrowWebhookBodySchema }),
    escrowWebhookController,
);

// Module routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1', userRoutes);
app.use('/api/v1', verificationRoutes);
app.use('/api/v1/geo', geoRoutes);
app.use('/api/v1', categoryRoutes);
app.use('/api/v1', listingRoutes);
app.use('/api/v1', subscriptionRoutes);
app.use('/api/v1', businessProfileRoutes);
app.use('/api/v1', craftsmanProfileRoutes);
app.use('/api/v1', preferenceRoutes);
app.use('/api/v1', chatRoutes);
app.use('/api/v1', dealRoutes);
app.use('/api/v1', adminRoutes);
app.use('/api/v1', reportRoutes);
app.use('/api/v1', mediaRoutes);
app.use('/api/v1', notificationRoutes);

// Error handler (must be last)
app.use(errorHandler);

export default app;
