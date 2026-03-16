import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = 'user@example.com';
  const password = 'password123';
  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      role: 'USER',
      emailVerifiedAt: new Date(),
      isActive: true,
    },
    create: {
      email,
      passwordHash,
      role: 'USER',
      emailVerifiedAt: new Date(),
      isActive: true,
    },
  });

  await prisma.profile.upsert({
    where: { userId: user.id },
    update: {
      fullName: 'مستخدم عادي',
    },
    create: {
      userId: user.id,
      fullName: 'مستخدم عادي',
    },
  });

  console.log('✅ تم إنشاء حساب المستخدم العادي بنجاح!');
  console.log(`البريد الإلكتروني: ${email}`);
  console.log(`كلمة المرور: ${password}`);
  console.log(`Role: ${user.role}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
