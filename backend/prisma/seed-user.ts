import { PrismaClient, Role, TrustTier } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    const email = 'user@souqly.com';
    const password = 'User123!@#';

    // Delete existing user first to ensure a clean state
    await prisma.user.deleteMany({ where: { email } });

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
        data: {
            email,
            passwordHash,
            role: Role.USER,
            isActive: true,
            trustTier: TrustTier.NEW,
            trustScore: 0,
            emailVerifiedAt: new Date(),
            profile: {
                create: {
                    fullName: 'مستخدم تجريبي',
                    username: 'test_user',
                }
            }
        },
    });

    // Verify immediately
    const found = await prisma.user.findUnique({ where: { id: user.id }, select: { passwordHash: true, emailVerifiedAt: true } });
    if (found?.passwordHash) {
        const ok = await bcrypt.compare(password, found.passwordHash);
        console.log(`✅ المستخدم: ${email}`);
        console.log(`✅ كلمة السر: ${password}`);
        console.log(`✅ التحقق من كلمة السر: ${ok ? 'ناجح' : 'فاشل!'}`);
        console.log(`✅ البريد موثق: ${found.emailVerifiedAt ? 'نعم' : 'لا'}`);
    }
}

main().finally(() => prisma.$disconnect());
