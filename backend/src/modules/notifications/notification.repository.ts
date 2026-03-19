import { Prisma, type NotificationType } from '@prisma/client';
import { prisma } from '../../shared/utils/prisma.js';

const notificationSelect = {
    id: true,
    type: true,
    title: true,
    body: true,
    targetType: true,
    targetId: true,
    link: true,
    isRead: true,
    readAt: true,
    createdAt: true,
} satisfies Prisma.NotificationSelect;

export type NotificationRecord = Prisma.NotificationGetPayload<{
    select: typeof notificationSelect;
}>;

export interface CreateNotificationRecordInput {
    userId: number;
    type: NotificationType;
    title: string;
    body: string;
    targetType?: string | null;
    targetId?: number | null;
    link?: string | null;
    dedupKey?: string | null;
}

export interface ListNotificationsFilters {
    userId: number;
    unreadOnly?: boolean;
    skip: number;
    take: number;
}

function buildWhere(filters: Pick<ListNotificationsFilters, 'userId' | 'unreadOnly'>): Prisma.NotificationWhereInput {
    return {
        userId: filters.userId,
        ...(filters.unreadOnly ? { isRead: false } : {}),
    };
}

export async function createNotificationRecord(
    input: CreateNotificationRecordInput,
): Promise<NotificationRecord> {
    return prisma.notification.create({
        data: {
            userId: input.userId,
            type: input.type,
            title: input.title,
            body: input.body,
            targetType: input.targetType ?? null,
            targetId: input.targetId ?? null,
            link: input.link ?? null,
            dedupKey: input.dedupKey ?? null,
        },
        select: notificationSelect,
    });
}

export async function listNotificationRecords(
    filters: ListNotificationsFilters,
): Promise<NotificationRecord[]> {
    return prisma.notification.findMany({
        where: buildWhere(filters),
        orderBy: { createdAt: 'desc' },
        skip: filters.skip,
        take: filters.take,
        select: notificationSelect,
    });
}

export async function countNotificationRecords(
    filters: Pick<ListNotificationsFilters, 'userId' | 'unreadOnly'>,
): Promise<number> {
    return prisma.notification.count({
        where: buildWhere(filters),
    });
}

export async function markNotificationRecordRead(
    userId: number,
    notificationId: number,
): Promise<NotificationRecord | null> {
    const existing = await prisma.notification.findFirst({
        where: {
            id: notificationId,
            userId,
        },
        select: {
            id: true,
            isRead: true,
        },
    });

    if (!existing) {
        return null;
    }

    return prisma.notification.update({
        where: { id: existing.id },
        data: {
            isRead: true,
            readAt: existing.isRead ? undefined : new Date(),
        },
        select: notificationSelect,
    });
}

export async function markAllNotificationRecordsRead(userId: number): Promise<number> {
    const result = await prisma.notification.updateMany({
        where: {
            userId,
            isRead: false,
        },
        data: {
            isRead: true,
            readAt: new Date(),
        },
    });

    return result.count;
}

export async function countUnreadNotificationRecords(userId: number): Promise<number> {
    return prisma.notification.count({
        where: {
            userId,
            isRead: false,
        },
    });
}

export async function getNotificationPreferenceRecord(userId: number): Promise<{
    chatMessages: boolean;
    offerUpdates: boolean;
    dealUpdates: boolean;
    systemAlerts: boolean;
} | null> {
    return prisma.notificationPreference.findUnique({
        where: { userId },
        select: {
            chatMessages: true,
            offerUpdates: true,
            dealUpdates: true,
            systemAlerts: true,
        },
    });
}
