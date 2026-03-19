import { AccountType, CraftsmanLeadStatus, type Prisma } from '@prisma/client';
import { prisma } from '../../shared/utils/prisma.js';
import { sanitizeNullableText } from '../../shared/utils/sanitize.js';

export type CraftsmanLeadSource = 'chat' | 'phone' | 'whatsapp' | 'direct';

export interface CreateCraftsmanLeadInput {
    fromUserId?: number | null;
    source: CraftsmanLeadSource;
    message?: string | null;
}

export async function createCraftsmanLead(
    craftsmanUserId: number,
    input: CreateCraftsmanLeadInput,
    tx: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<void> {
    if (input.fromUserId && input.fromUserId === craftsmanUserId) {
        return;
    }

    const craftsmanUser = await tx.user.findUnique({
        where: { id: craftsmanUserId },
        select: {
            accountType: true,
            isActive: true,
            bannedAt: true,
        },
    });

    if (
        !craftsmanUser
        || craftsmanUser.accountType !== AccountType.CRAFTSMAN
        || !craftsmanUser.isActive
        || craftsmanUser.bannedAt
    ) {
        return;
    }

    await tx.craftsmanLead.create({
        data: {
            craftsmanUserId,
            fromUserId: input.fromUserId ?? null,
            source: input.source,
            message: sanitizeNullableText(input.message ?? null),
            status: CraftsmanLeadStatus.NEW,
        },
    });
}
