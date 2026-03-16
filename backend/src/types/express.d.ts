import type { AccountType, Role, StaffRole, TrustTier } from '@prisma/client';

export interface AuthUser {
    userId: number;
    role: Role;
    staffRole: StaffRole;
    accountType: AccountType;
    trustTier: TrustTier;
}

declare global {
    namespace Express {
        interface Request {
            user?: AuthUser;
        }
    }
}

export {};
