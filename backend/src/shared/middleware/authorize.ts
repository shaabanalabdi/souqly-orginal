import type { StaffRole } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';
import { resolveStaffRole } from '../auth/authorization.js';

export type AuthorizeRole = StaffRole;

export function authorize(...roles: AuthorizeRole[]) {
    return (req: Request, res: Response, next: NextFunction): void => {
        if (!req.user) {
            res.status(401).json({
                success: false,
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'Authentication required.',
                },
            });
            return;
        }

        if (roles.length === 0) {
            next();
            return;
        }

        const allowed = new Set(roles.map((role) => String(role)));
        const staffRole = resolveStaffRole(req.user);
        const isAllowed = allowed.has(String(staffRole));

        if (!isAllowed) {
            res.status(403).json({
                success: false,
                error: {
                    code: 'FORBIDDEN',
                    message: 'You are not allowed to access this resource.',
                },
            });
            return;
        }

        next();
    };
}
