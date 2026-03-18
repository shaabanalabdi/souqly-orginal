import bcrypt from 'bcrypt';
import { Role, StaffRole, TrustTier } from '@prisma/client';
import { prisma } from '../utils/prisma.js';
import { logger } from '../utils/logger.js';

const DEFAULT_DEV_ADMIN_EMAIL = 'admin@souqly.com';
const DEFAULT_DEV_ADMIN_PASSWORD = 'Admin123!@#';

function resolveBootstrapAdminCredentials():
    | { email: string; password: string }
    | null {
    const configuredEmail = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
    const configuredPassword = process.env.SEED_ADMIN_PASSWORD?.trim();

    if (configuredEmail && configuredPassword) {
        return {
            email: configuredEmail,
            password: configuredPassword,
        };
    }

    if (process.env.NODE_ENV !== 'production') {
        return {
            email: DEFAULT_DEV_ADMIN_EMAIL,
            password: DEFAULT_DEV_ADMIN_PASSWORD,
        };
    }

    return null;
}

export async function ensureBootstrapAdmin(): Promise<void> {
    const credentials = resolveBootstrapAdminCredentials();
    if (!credentials) {
        logger.warn(
            'Skipping bootstrap admin creation because SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD are not configured.',
        );
        return;
    }

    const passwordHash = await bcrypt.hash(credentials.password, 12);

    await prisma.user.upsert({
        where: { email: credentials.email },
        update: {
            role: Role.ADMIN,
            staffRole: StaffRole.ADMIN,
            isActive: true,
            passwordHash,
            trustTier: TrustTier.TOP_SELLER,
            trustScore: 100,
            emailVerifiedAt: new Date(),
        },
        create: {
            email: credentials.email,
            role: Role.ADMIN,
            staffRole: StaffRole.ADMIN,
            isActive: true,
            passwordHash,
            trustTier: TrustTier.TOP_SELLER,
            trustScore: 100,
            emailVerifiedAt: new Date(),
        },
    });
}
