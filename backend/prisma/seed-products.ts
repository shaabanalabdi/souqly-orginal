import { PrismaClient, ListingStatus, Condition } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // get user admin@souqly.com
    const user = await prisma.user.findFirst({ where: { email: 'admin@souqly.com' } });
    if (!user) throw new Error('admin user not found');

    const subcategory = await prisma.subcategory.findFirst();
    const country = await prisma.country.findFirst();
    const city = await prisma.city.findFirst();

    if (!subcategory || !country || !city) throw new Error('Need categories and geos');

    // Create 3 random listings
    const products = [
        {
            titleAr: 'تويوتا كامري 2022',
            descriptionAr: 'سيارة تويوتا كامري للبيع بحالة ممتازة جدا، استخدام شخصي.',
            price: 75000
        },
        {
            titleAr: 'لابتوب أبل ماك بوك برو',
            descriptionAr: 'ماك بوك برو شريحة M2 مع رامات 16 جيجا بحالة شبه جديدة.',
            price: 5000
        },
        {
            titleAr: 'شقة فاخرة للإيجار',
            descriptionAr: 'شقة 3 غرف نوم وصالة مع إطلالة رائعة وموقف سيارة.',
            price: 3500
        }
    ];

    for (const p of products) {
        await prisma.listing.create({
            data: {
                userId: user.id,
                subcategoryId: subcategory.id,
                countryId: country.id,
                cityId: city.id,
                titleAr: p.titleAr,
                descriptionAr: p.descriptionAr,
                priceAmount: p.price,
                currency: 'USD',
                condition: Condition.USED,
                status: ListingStatus.ACTIVE,
                images: {
                    create: [
                        {
                            urlOriginal: 'https://placehold.co/600x400/png?text=Image',
                            urlMedium: 'https://placehold.co/400x300/png?text=Image',
                            urlThumb: 'https://placehold.co/200x200/png?text=Image',
                            urlMini: 'https://placehold.co/100x100/png?text=Image'
                        }
                    ]
                }
            }
        });
    }

    console.log('Random products created successfully.');
}

main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        console.error(e);
        await prisma.$disconnect();
    });
