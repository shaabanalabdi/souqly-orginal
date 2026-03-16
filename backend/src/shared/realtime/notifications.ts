import type { Server as SocketServer } from 'socket.io';

export const PLATFORM_NOTIFICATION_EVENT = 'platform:notification';

export interface PlatformNotificationPayload {
    kind: 'deal_update' | 'report_update' | 'moderation' | 'report_queue' | 'system';
    title: string;
    body: string;
    link?: string;
    threadId?: number;
    createdAt: string;
}

function userRoom(userId: number): string {
    return `user:${userId}`;
}

export function emitPlatformNotification(
    io: SocketServer,
    userIds: number[],
    payload: Omit<PlatformNotificationPayload, 'createdAt'> & { createdAt?: string },
): void {
    const finalPayload: PlatformNotificationPayload = {
        ...payload,
        createdAt: payload.createdAt ?? new Date().toISOString(),
    };

    const uniqueUserIds = Array.from(new Set(userIds.filter((userId) => Number.isInteger(userId) && userId > 0)));

    for (const userId of uniqueUserIds) {
        io.to(userRoom(userId)).emit(PLATFORM_NOTIFICATION_EVENT, finalPayload);
    }
}
