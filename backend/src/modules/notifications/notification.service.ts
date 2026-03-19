import { NotificationType, Prisma } from '@prisma/client';
import { ApiError } from '../../shared/middleware/errorHandler.js';
import { buildPaginationMeta, getSkip, parsePagination } from '../../shared/utils/pagination.js';
import {
    countNotificationRecords,
    countUnreadNotificationRecords,
    createNotificationRecord,
    getNotificationPreferenceRecord,
    listNotificationRecords,
    markAllNotificationRecordsRead,
    markNotificationRecordRead,
    type CreateNotificationRecordInput,
    type NotificationRecord,
} from './notification.repository.js';

export interface NotificationDto {
    id: number;
    type: string;
    title: string;
    body: string;
    targetType: string | null;
    targetId: number | null;
    link: string | null;
    isRead: boolean;
    readAt: string | null;
    createdAt: string;
}

export interface CreateNotificationPayload {
    userId: number;
    type: NotificationType | string;
    title: string;
    body: string;
    targetType?: string;
    targetId?: number;
    link?: string;
    dedupKey?: string;
}

function serialize(record: NotificationRecord): NotificationDto {
    return {
        id: record.id,
        type: record.type,
        title: record.title,
        body: record.body,
        targetType: record.targetType,
        targetId: record.targetId,
        link: record.link,
        isRead: record.isRead,
        readAt: record.readAt?.toISOString() ?? null,
        createdAt: record.createdAt.toISOString(),
    };
}

function normalizeNotificationType(type: NotificationType | string): NotificationType {
    if (typeof type === 'string' && type in NotificationType) {
        return type as NotificationType;
    }

    return NotificationType.SYSTEM;
}

function isPreferenceEnabled(
    type: NotificationType,
    preference: {
        chatMessages: boolean;
        offerUpdates: boolean;
        dealUpdates: boolean;
        systemAlerts: boolean;
    } | null,
): boolean {
    if (!preference) {
        return true;
    }

    if (
        type === NotificationType.MESSAGE_RECEIVED
        || type === NotificationType.PHONE_REQUESTED
    ) {
        return preference.chatMessages;
    }

    if (
        type === NotificationType.OFFER_RECEIVED
        || type === NotificationType.OFFER_RESPONDED
    ) {
        return preference.offerUpdates;
    }

    if (
        type === NotificationType.DEAL_CREATED
        || type === NotificationType.DEAL_CONFIRMED
        || type === NotificationType.DEAL_COMPLETED
        || type === NotificationType.DEAL_CANCELLED
        || type === NotificationType.DEAL_DISPUTED
        || type === NotificationType.ESCROW_HELD
        || type === NotificationType.ESCROW_RELEASED
        || type === NotificationType.ESCROW_REFUNDED
        || type === NotificationType.DISPUTE_OPENED
        || type === NotificationType.DISPUTE_RESOLVED
        || type === NotificationType.REVIEW_RECEIVED
        || type === NotificationType.SUBSCRIPTION_ACTIVATED
        || type === NotificationType.SUBSCRIPTION_EXPIRED
    ) {
        return preference.dealUpdates;
    }

    return preference.systemAlerts;
}

export async function createPersistentNotification(
    payload: CreateNotificationPayload,
): Promise<NotificationDto | null> {
    const type = normalizeNotificationType(payload.type);
    const preference = await getNotificationPreferenceRecord(payload.userId);
    if (!isPreferenceEnabled(type, preference)) {
        return null;
    }

    const createInput: CreateNotificationRecordInput = {
        userId: payload.userId,
        type,
        title: payload.title,
        body: payload.body,
        targetType: payload.targetType ?? null,
        targetId: payload.targetId ?? null,
        link: payload.link ?? null,
        dedupKey: payload.dedupKey ?? null,
    };

    try {
        const notification = await createNotificationRecord(createInput);
        return serialize(notification);
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            return null;
        }

        throw error;
    }
}

export async function listNotifications(
    userId: number,
    query: Record<string, unknown>,
): Promise<{
    items: NotificationDto[];
    meta: ReturnType<typeof buildPaginationMeta>;
}> {
    const pagination = parsePagination(query);
    const unreadOnly = query.unreadOnly === true || query.unreadOnly === 'true';

    const [total, rows] = await Promise.all([
        countNotificationRecords({ userId, unreadOnly }),
        listNotificationRecords({
            userId,
            unreadOnly,
            skip: getSkip(pagination),
            take: pagination.limit,
        }),
    ]);

    return {
        items: rows.map(serialize),
        meta: buildPaginationMeta(total, pagination),
    };
}

export async function markNotificationRead(
    userId: number,
    notificationId: number,
): Promise<NotificationDto> {
    const updated = await markNotificationRecordRead(userId, notificationId);
    if (!updated) {
        throw new ApiError(404, 'NOTIFICATION_NOT_FOUND', 'Notification not found.');
    }

    return serialize(updated);
}

export async function markAllNotificationsRead(userId: number): Promise<{ updatedCount: number }> {
    const updatedCount = await markAllNotificationRecordsRead(userId);
    return { updatedCount };
}

export async function getUnreadCount(userId: number): Promise<{ count: number }> {
    const count = await countUnreadNotificationRecords(userId);
    return { count };
}

type NotifyOptions = Omit<CreateNotificationPayload, 'userId'>;

export async function notifyUser(userId: number, opts: NotifyOptions): Promise<NotificationDto | null> {
    return createPersistentNotification({ userId, ...opts });
}

export async function notifyUsers(userIds: number[], opts: NotifyOptions): Promise<void> {
    await Promise.allSettled(userIds.map((uid) => notifyUser(uid, opts)));
}
