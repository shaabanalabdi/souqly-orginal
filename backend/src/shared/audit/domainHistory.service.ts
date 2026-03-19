import type {
    AccountType,
    ListingStatus,
    Prisma,
    StaffRole,
} from '@prisma/client';
import { prisma } from '../utils/prisma.js';

type DbClient = Prisma.TransactionClient | typeof prisma;

export interface RecordListingStatusHistoryInput {
    listingId: number;
    oldStatus: ListingStatus;
    newStatus: ListingStatus;
    actorId: number;
    reason?: string | null;
}

export interface RecordUserRoleHistoryInput {
    userId: number;
    changedById: number;
    oldStaffRole: StaffRole;
    newStaffRole: StaffRole;
    oldAccountType: AccountType;
    newAccountType: AccountType;
    reason?: string | null;
}

export async function recordListingStatusHistory(
    input: RecordListingStatusHistoryInput,
    db: DbClient = prisma,
): Promise<void> {
    if (input.oldStatus === input.newStatus) {
        return;
    }

    await db.listingStatusHistory.create({
        data: {
            listingId: input.listingId,
            oldStatus: input.oldStatus,
            newStatus: input.newStatus,
            actorId: input.actorId,
            reason: input.reason ?? null,
        },
    });
}

export async function recordUserRoleHistory(
    input: RecordUserRoleHistoryInput,
    db: DbClient = prisma,
): Promise<void> {
    if (
        input.oldStaffRole === input.newStaffRole
        && input.oldAccountType === input.newAccountType
    ) {
        return;
    }

    await db.userRoleHistory.create({
        data: {
            userId: input.userId,
            changedById: input.changedById,
            oldStaffRole: input.oldStaffRole,
            newStaffRole: input.newStaffRole,
            oldAccountType: input.oldAccountType,
            newAccountType: input.newAccountType,
            reason: input.reason ?? null,
        },
    });
}
