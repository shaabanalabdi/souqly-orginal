import { Queue, Worker, type JobsOptions } from 'bullmq';
import { NotificationType, TrustScoreEventType, type Prisma } from '@prisma/client';
import type { Server as SocketServer } from 'socket.io';
import { createPersistentNotification } from '../modules/notifications/notification.service.js';
import { recalculateUserTrustScore } from '../modules/trust/trust.service.js';
import { sendEmail } from '../shared/utils/email.js';
import { emitPlatformNotification } from '../shared/realtime/notifications.js';
import { logger } from '../shared/utils/logger.js';

type PlatformNotificationKind = 'deal_update' | 'report_update' | 'moderation' | 'report_queue' | 'system';

export interface NotificationJobPayload {
    recipientUserIds: number[];
    notificationType: NotificationType;
    platformKind: PlatformNotificationKind;
    title: string;
    body: string;
    targetType?: string;
    targetId?: number;
    link?: string;
    dedupKey?: string;
}

export interface TrustScoreRecalculationJobPayload {
    userId: number;
    eventType: TrustScoreEventType;
    metadata?: Record<string, unknown>;
}

export interface EmailJobPayload {
    to: string;
    subject: string;
    html: string;
}

export interface WebhookRetryJobPayload {
    url: string;
    payload: Record<string, unknown>;
    headers?: Record<string, string>;
}

interface QueueRuntime {
    io?: SocketServer;
    notificationQueue: Queue;
    trustQueue: Queue;
    emailQueue: Queue;
    webhookRetryQueue: Queue;
    notificationWorker: Worker;
    trustWorker: Worker;
    emailWorker: Worker;
    webhookRetryWorker: Worker;
}

const notificationQueueName = 'notifications';
const trustQueueName = 'trust-score';
const emailQueueName = 'email';
const webhookRetryQueueName = 'webhook-retry';

const defaultJobOptions: JobsOptions = {
    attempts: 3,
    backoff: {
        type: 'exponential',
        delay: 1000,
    },
    removeOnComplete: 1000,
    removeOnFail: 1000,
};

let runtime: QueueRuntime | null = null;

function createBullConnection() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const parsed = new URL(redisUrl);
    const port = parsed.port ? parseInt(parsed.port, 10) : 6379;
    const dbPath = parsed.pathname.replace('/', '');

    return {
        host: parsed.hostname,
        port,
        username: parsed.username || undefined,
        password: parsed.password || undefined,
        db: dbPath ? parseInt(dbPath, 10) : undefined,
        maxRetriesPerRequest: null,
    };
}

function sanitizeRecipientIds(userIds: number[]): number[] {
    return Array.from(new Set(userIds.filter((userId) => Number.isInteger(userId) && userId > 0)));
}

async function handleNotificationJob(
    payload: NotificationJobPayload,
    io?: SocketServer,
): Promise<void> {
    const recipients = sanitizeRecipientIds(payload.recipientUserIds);

    for (const userId of recipients) {
        const created = await createPersistentNotification({
            userId,
            type: payload.notificationType,
            title: payload.title,
            body: payload.body,
            targetType: payload.targetType,
            targetId: payload.targetId,
            link: payload.link,
            dedupKey: payload.dedupKey ? `${payload.dedupKey}:user:${userId}` : undefined,
        });

        if (!created || !io) {
            continue;
        }

        emitPlatformNotification(io, [userId], {
            kind: payload.platformKind,
            title: payload.title,
            body: payload.body,
            link: payload.link,
        });
    }
}

async function handleTrustScoreRecalculationJob(
    payload: TrustScoreRecalculationJobPayload,
): Promise<void> {
    await recalculateUserTrustScore(payload.userId, {
        eventType: payload.eventType,
        metadata: payload.metadata as Prisma.InputJsonValue | undefined,
    });
}

async function handleEmailJob(payload: EmailJobPayload): Promise<void> {
    await sendEmail(payload);
}

async function handleWebhookRetryJob(payload: WebhookRetryJobPayload): Promise<void> {
    const response = await fetch(payload.url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(payload.headers ?? {}),
        },
        body: JSON.stringify(payload.payload),
    });

    if (!response.ok) {
        throw new Error(`Webhook retry failed with status ${response.status}`);
    }
}

function wireWorkerLogging(worker: Worker, label: string): void {
    worker.on('failed', (job, error) => {
        logger.error(`${label} job failed (${job?.id ?? 'unknown'})`, error);
    });

    worker.on('error', (error) => {
        logger.error(`${label} worker error`, error);
    });
}

export async function initializeQueues(options: { io?: SocketServer } = {}): Promise<void> {
    if (runtime) {
        runtime.io = options.io ?? runtime.io;
        return;
    }

    const queueConnection = createBullConnection();
    const workerConnection = createBullConnection();

    const notificationQueue = new Queue(notificationQueueName, {
        connection: queueConnection,
        defaultJobOptions,
    });
    const trustQueue = new Queue(trustQueueName, {
        connection: queueConnection,
        defaultJobOptions,
    });
    const emailQueue = new Queue(emailQueueName, {
        connection: queueConnection,
        defaultJobOptions,
    });
    const webhookRetryQueue = new Queue(webhookRetryQueueName, {
        connection: queueConnection,
        defaultJobOptions,
    });

    const notificationWorker = new Worker(
        notificationQueueName,
        async (job) => handleNotificationJob(job.data as NotificationJobPayload, runtime?.io),
        { connection: workerConnection, concurrency: 10 },
    );
    const trustWorker = new Worker(
        trustQueueName,
        async (job) => handleTrustScoreRecalculationJob(job.data as TrustScoreRecalculationJobPayload),
        { connection: workerConnection, concurrency: 4 },
    );
    const emailWorker = new Worker(
        emailQueueName,
        async (job) => handleEmailJob(job.data as EmailJobPayload),
        { connection: workerConnection, concurrency: 3 },
    );
    const webhookRetryWorker = new Worker(
        webhookRetryQueueName,
        async (job) => handleWebhookRetryJob(job.data as WebhookRetryJobPayload),
        { connection: workerConnection, concurrency: 2 },
    );

    wireWorkerLogging(notificationWorker, 'notifications');
    wireWorkerLogging(trustWorker, 'trust-score');
    wireWorkerLogging(emailWorker, 'email');
    wireWorkerLogging(webhookRetryWorker, 'webhook-retry');

    runtime = {
        io: options.io,
        notificationQueue,
        trustQueue,
        emailQueue,
        webhookRetryQueue,
        notificationWorker,
        trustWorker,
        emailWorker,
        webhookRetryWorker,
    };
}

export async function closeQueues(): Promise<void> {
    if (!runtime) {
        return;
    }

    await Promise.allSettled([
        runtime.notificationWorker.close(),
        runtime.trustWorker.close(),
        runtime.emailWorker.close(),
        runtime.webhookRetryWorker.close(),
        runtime.notificationQueue.close(),
        runtime.trustQueue.close(),
        runtime.emailQueue.close(),
        runtime.webhookRetryQueue.close(),
    ]);

    runtime = null;
}

export async function enqueueNotificationJob(payload: NotificationJobPayload): Promise<void> {
    if (!runtime) {
        await handleNotificationJob(payload);
        return;
    }

    await runtime.notificationQueue.add('deliver-notification', payload, {
        jobId: payload.dedupKey ?? undefined,
    });
}

export async function enqueueTrustScoreRecalculationJob(
    payload: TrustScoreRecalculationJobPayload,
): Promise<void> {
    if (!runtime) {
        await handleTrustScoreRecalculationJob(payload);
        return;
    }

    await runtime.trustQueue.add('recalculate-trust', payload, {
        jobId: `${payload.userId}:${payload.eventType}:${JSON.stringify(payload.metadata ?? {})}`,
    });
}

export async function enqueueEmailJob(payload: EmailJobPayload): Promise<void> {
    if (!runtime) {
        await handleEmailJob(payload);
        return;
    }

    await runtime.emailQueue.add('deliver-email', payload);
}

export async function enqueueWebhookRetryJob(payload: WebhookRetryJobPayload): Promise<void> {
    if (!runtime) {
        await handleWebhookRetryJob(payload);
        return;
    }

    await runtime.webhookRetryQueue.add('retry-webhook', payload);
}
