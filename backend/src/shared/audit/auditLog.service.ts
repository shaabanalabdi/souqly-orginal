import type { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma.js';

type DbClient = Prisma.TransactionClient | typeof prisma;

export interface CreateAuditLogInput {
    adminId: number;
    action: string;
    entityType: string;
    entityId: number;
    oldData?: Prisma.InputJsonValue;
    newData?: Prisma.InputJsonValue;
    ipAddress?: string | null;
}

export async function createAuditLog(
    input: CreateAuditLogInput,
    db: DbClient = prisma,
): Promise<void> {
    await db.auditLog.create({
        data: {
            adminId: input.adminId,
            action: input.action,
            entityType: input.entityType,
            entityId: input.entityId,
            oldData: input.oldData,
            newData: input.newData,
            ipAddress: input.ipAddress ?? null,
        },
    });
}
