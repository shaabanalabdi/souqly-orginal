import type { Request, Response, NextFunction } from 'express';
import {
    getUnreadCount,
    listNotifications,
    markAllNotificationsRead,
    markNotificationRead,
} from './notification.service.js';

export async function listNotificationsController(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const userId = req.user!.userId;
        const result = await listNotifications(userId, req.query as Record<string, unknown>);
        res.json({ success: true, data: result.items, meta: result.meta });
    } catch (err) {
        next(err);
    }
}

export async function markReadController(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const userId = req.user!.userId;
        const notificationId = parseInt(req.params.id, 10);
        const updated = await markNotificationRead(userId, notificationId);
        res.json({ success: true, data: updated });
    } catch (err) {
        next(err);
    }
}

export async function markAllReadController(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const userId = req.user!.userId;
        const result = await markAllNotificationsRead(userId);
        res.json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
}

export async function unreadCountController(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const userId = req.user!.userId;
        const result = await getUnreadCount(userId);
        res.json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
}
