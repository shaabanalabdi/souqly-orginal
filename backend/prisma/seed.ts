import { PrismaClient, Role, StaffRole, TrustTier, AttributeType } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

type SeedCity = {
    nameAr: string;
    nameEn: string;
    latitude: number;
    longitude: number;
};

type SeedCountry = {
    nameAr: string;
    nameEn: string;
    code: string;
    currencyCode: string;
    currencySymbol: string;
    phoneCode: string;
    cities: SeedCity[];
};

type SeedAttribute = {
    nameAr: string;
    nameEn: string;
    slug: string;
    type: AttributeType;
    isRequired: boolean;
    isFilterable: boolean;
    options?: string[];
};

type SeedSubcategory = {
    nameAr: string;
    nameEn: string;
    slug: string;
    attributes: SeedAttribute[];
};

type SeedCategory = {
    nameAr: string;
    nameEn: string;
    slug: string;
    icon: string;
    subcategories: SeedSubcategory[];
};

const countries: SeedCountry[] = [
    {
        nameAr: 'سوريا',
        nameEn: 'Syria',
        code: 'SY',
        currencyCode: 'SYP',
        currencySymbol: 'ل.س',
        phoneCode: '+963',
        cities: [
            { nameAr: 'دمشق', nameEn: 'Damascus', latitude: 33.5138, longitude: 36.2765 },
            { nameAr: 'حلب', nameEn: 'Aleppo', latitude: 36.2021, longitude: 37.1343 },
            { nameAr: 'حمص', nameEn: 'Homs', latitude: 34.7308, longitude: 36.7143 },
            { nameAr: 'اللاذقية', nameEn: 'Latakia', latitude: 35.5317, longitude: 35.7897 },
            { nameAr: 'طرطوس', nameEn: 'Tartus', latitude: 34.8888, longitude: 35.8872 },
        ],
    },
    {
        nameAr: 'العراق',
        nameEn: 'Iraq',
        code: 'IQ',
        currencyCode: 'IQD',
        currencySymbol: 'د.ع',
        phoneCode: '+964',
        cities: [
            { nameAr: 'بغداد', nameEn: 'Baghdad', latitude: 33.3152, longitude: 44.3661 },
            { nameAr: 'البصرة', nameEn: 'Basra', latitude: 30.5081, longitude: 47.7835 },
            { nameAr: 'أربيل', nameEn: 'Erbil', latitude: 36.1911, longitude: 44.0092 },
            { nameAr: 'الموصل', nameEn: 'Mosul', latitude: 36.3350, longitude: 43.1189 },
        ],
    },
    {
        nameAr: 'الأردن',
        nameEn: 'Jordan',
        code: 'JO',
        currencyCode: 'JOD',
        currencySymbol: 'د.أ',
        phoneCode: '+962',
        cities: [
            { nameAr: 'عمّان', nameEn: 'Amman', latitude: 31.9454, longitude: 35.9284 },
            { nameAr: 'إربد', nameEn: 'Irbid', latitude: 32.5556, longitude: 35.8497 },
            { nameAr: 'الزرقاء', nameEn: 'Zarqa', latitude: 32.0728, longitude: 36.0877 },
        ],
    },
    {
        nameAr: 'لبنان',
        nameEn: 'Lebanon',
        code: 'LB',
        currencyCode: 'LBP',
        currencySymbol: 'ل.ل',
        phoneCode: '+961',
        cities: [
            { nameAr: 'بيروت', nameEn: 'Beirut', latitude: 33.8938, longitude: 35.5018 },
            { nameAr: 'طرابلس', nameEn: 'Tripoli', latitude: 34.4333, longitude: 35.8333 },
            { nameAr: 'صيدا', nameEn: 'Sidon', latitude: 33.5631, longitude: 35.3689 },
        ],
    },
    {
        nameAr: 'فلسطين',
        nameEn: 'Palestine',
        code: 'PS',
        currencyCode: 'ILS',
        currencySymbol: '₪',
        phoneCode: '+970',
        cities: [
            { nameAr: 'رام الله', nameEn: 'Ramallah', latitude: 31.9029, longitude: 35.2062 },
            { nameAr: 'غزة', nameEn: 'Gaza', latitude: 31.5000, longitude: 34.4667 },
            { nameAr: 'نابلس', nameEn: 'Nablus', latitude: 32.2211, longitude: 35.2544 },
        ],
    },
];

const categories: SeedCategory[] = [
    {
        nameAr: 'مركبات',
        nameEn: 'Vehicles',
        slug: 'vehicles',
        icon: 'car',
        subcategories: [
            {
                nameAr: 'سيارات للبيع',
                nameEn: 'Cars for Sale',
                slug: 'cars-for-sale',
                attributes: [
                    {
                        nameAr: 'الماركة',
                        nameEn: 'Brand',
                        slug: 'brand',
                        type: AttributeType.SELECT,
                        isRequired: true,
                        isFilterable: true,
                        options: ['Toyota', 'Hyundai', 'Kia', 'BMW', 'Mercedes', 'Nissan', 'Honda', 'Ford', 'Chevrolet'],
                    },
                    {
                        nameAr: 'الموديل',
                        nameEn: 'Model',
                        slug: 'model',
                        type: AttributeType.TEXT,
                        isRequired: true,
                        isFilterable: false,
                    },
                    {
                        nameAr: 'سنة الصنع',
                        nameEn: 'Year',
                        slug: 'year',
                        type: AttributeType.NUMBER,
                        isRequired: true,
                        isFilterable: true,
                    },
                ],
            },
        ],
    },
    {
        nameAr: 'عقارات',
        nameEn: 'Real Estate',
        slug: 'real-estate',
        icon: 'home',
        subcategories: [
            {
                nameAr: 'شقق للبيع',
                nameEn: 'Apartments for Sale',
                slug: 'apartments-for-sale',
                attributes: [
                    {
                        nameAr: 'المساحة',
                        nameEn: 'Area',
                        slug: 'area',
                        type: AttributeType.NUMBER,
                        isRequired: true,
                        isFilterable: true,
                    },
                    {
                        nameAr: 'عدد الغرف',
                        nameEn: 'Rooms',
                        slug: 'rooms',
                        type: AttributeType.SELECT,
                        isRequired: true,
                        isFilterable: true,
                        options: ['1', '2', '3', '4', '5+'],
                    },
                ],
            },
        ],
    },
    {
        nameAr: 'موبايلات وتابلت',
        nameEn: 'Mobiles & Tablets',
        slug: 'mobiles',
        icon: 'phone',
        subcategories: [
            {
                nameAr: 'موبايلات',
                nameEn: 'Mobile Phones',
                slug: 'mobile-phones',
                attributes: [
                    {
                        nameAr: 'الماركة',
                        nameEn: 'Brand',
                        slug: 'brand',
                        type: AttributeType.SELECT,
                        isRequired: true,
                        isFilterable: true,
                        options: ['Apple', 'Samsung', 'Xiaomi', 'Huawei', 'Oppo', 'Vivo', 'OnePlus'],
                    },
                    {
                        nameAr: 'سعة التخزين',
                        nameEn: 'Storage',
                        slug: 'storage',
                        type: AttributeType.SELECT,
                        isRequired: true,
                        isFilterable: true,
                        options: ['32GB', '64GB', '128GB', '256GB', '512GB', '1TB'],
                    },
                ],
            },
        ],
    },
];

async function seedAdmin(): Promise<void> {
    const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@souqly.com';
    const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Admin123!@#';
    const passwordHash = await bcrypt.hash(adminPassword, 12);

    await prisma.user.upsert({
        where: { email: adminEmail },
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
            email: adminEmail,
            passwordHash,
            role: Role.ADMIN,
            staffRole: StaffRole.ADMIN,
            isActive: true,
            trustTier: TrustTier.TOP_SELLER,
            trustScore: 100,
            emailVerifiedAt: new Date(),
        },
    });
}

async function seedGeo(): Promise<void> {
    for (const [countryIndex, countryData] of countries.entries()) {
        const country = await prisma.country.upsert({
            where: { code: countryData.code },
            update: {
                nameAr: countryData.nameAr,
                nameEn: countryData.nameEn,
                currencyCode: countryData.currencyCode,
                currencySymbol: countryData.currencySymbol,
                phoneCode: countryData.phoneCode,
                sortOrder: countryIndex,
                isActive: true,
            },
            create: {
                nameAr: countryData.nameAr,
                nameEn: countryData.nameEn,
                code: countryData.code,
                currencyCode: countryData.currencyCode,
                currencySymbol: countryData.currencySymbol,
                phoneCode: countryData.phoneCode,
                sortOrder: countryIndex,
                isActive: true,
            },
        });

        for (const [cityIndex, cityData] of countryData.cities.entries()) {
            const existing = await prisma.city.findFirst({
                where: {
                    countryId: country.id,
                    nameEn: cityData.nameEn,
                },
            });

            if (existing) {
                await prisma.city.update({
                    where: { id: existing.id },
                    data: {
                        nameAr: cityData.nameAr,
                        latitude: cityData.latitude,
                        longitude: cityData.longitude,
                        sortOrder: cityIndex,
                        isActive: true,
                    },
                });
            } else {
                await prisma.city.create({
                    data: {
                        countryId: country.id,
                        nameAr: cityData.nameAr,
                        nameEn: cityData.nameEn,
                        latitude: cityData.latitude,
                        longitude: cityData.longitude,
                        sortOrder: cityIndex,
                        isActive: true,
                    },
                });
            }
        }
    }
}

async function seedCategories(): Promise<void> {
    for (const [categoryIndex, categoryData] of categories.entries()) {
        const category = await prisma.category.upsert({
            where: { slug: categoryData.slug },
            update: {
                nameAr: categoryData.nameAr,
                nameEn: categoryData.nameEn,
                icon: categoryData.icon,
                sortOrder: categoryIndex,
                isActive: true,
            },
            create: {
                nameAr: categoryData.nameAr,
                nameEn: categoryData.nameEn,
                slug: categoryData.slug,
                icon: categoryData.icon,
                sortOrder: categoryIndex,
                isActive: true,
            },
        });

        for (const [subIndex, subcategoryData] of categoryData.subcategories.entries()) {
            const subcategory = await prisma.subcategory.upsert({
                where: { slug: subcategoryData.slug },
                update: {
                    categoryId: category.id,
                    nameAr: subcategoryData.nameAr,
                    nameEn: subcategoryData.nameEn,
                    sortOrder: subIndex,
                    isActive: true,
                },
                create: {
                    categoryId: category.id,
                    nameAr: subcategoryData.nameAr,
                    nameEn: subcategoryData.nameEn,
                    slug: subcategoryData.slug,
                    sortOrder: subIndex,
                    isActive: true,
                },
            });

            for (const [attrIndex, attributeData] of subcategoryData.attributes.entries()) {
                const existing = await prisma.attributeDefinition.findFirst({
                    where: {
                        subcategoryId: subcategory.id,
                        slug: attributeData.slug,
                    },
                });

                if (existing) {
                    await prisma.attributeDefinition.update({
                        where: { id: existing.id },
                        data: {
                            nameAr: attributeData.nameAr,
                            nameEn: attributeData.nameEn,
                            type: attributeData.type,
                            options: attributeData.options ?? null,
                            isRequired: attributeData.isRequired,
                            isFilterable: attributeData.isFilterable,
                            sortOrder: attrIndex,
                        },
                    });
                } else {
                    await prisma.attributeDefinition.create({
                        data: {
                            subcategoryId: subcategory.id,
                            nameAr: attributeData.nameAr,
                            nameEn: attributeData.nameEn,
                            slug: attributeData.slug,
                            type: attributeData.type,
                            options: attributeData.options ?? null,
                            isRequired: attributeData.isRequired,
                            isFilterable: attributeData.isFilterable,
                            sortOrder: attrIndex,
                        },
                    });
                }
            }
        }
    }
}

async function main(): Promise<void> {
    await seedGeo();
    await seedCategories();
    await seedAdmin();
}

main()
    .then(async () => {
        await prisma.$disconnect();
        // eslint-disable-next-line no-console
        console.log('Seed completed successfully.');
    })
    .catch(async (error: unknown) => {
        // eslint-disable-next-line no-console
        console.error('Seed failed:', error);
        await prisma.$disconnect();
        process.exit(1);
    });
