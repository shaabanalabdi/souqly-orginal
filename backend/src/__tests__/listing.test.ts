import request from 'supertest';
import app from '../app.js';
import { prisma } from '../shared/utils/prisma.js';
import { signAccessToken } from '../shared/utils/jwt.js';

describe('Listing routes', () => {
    it('GET /api/v1/listings returns paginated active listings', async () => {
        jest.spyOn(prisma.listing, 'count').mockResolvedValue(1);
        jest.spyOn(prisma.listing, 'findMany').mockResolvedValue([
            {
                id: 100,
                titleAr: 'عنوان عربي',
                titleEn: 'English title',
                descriptionAr: 'وصف عربي طويل بما يكفي للاختبار',
                descriptionEn: 'Long enough english description for testing',
                priceAmount: 2000,
                currency: 'USD',
                negotiable: true,
                condition: 'USED',
                status: 'ACTIVE',
                createdAt: new Date('2026-01-01T00:00:00.000Z'),
                country: { id: 1, code: 'SY', nameAr: 'سوريا', nameEn: 'Syria' },
                city: { id: 10, nameAr: 'دمشق', nameEn: 'Damascus' },
                subcategory: { id: 5, slug: 'cars-for-sale', nameAr: 'سيارات', nameEn: 'Cars' },
                images: [{ urlThumb: 'https://img.example/thumb.jpg' }],
            },
        ] as never);

        const response = await request(app).get('/api/v1/listings?lang=en');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].title).toBe('English title');
        expect(response.body.meta.total).toBe(1);
    });

    it('GET /api/v1/listings expands dialect aliases in text search', async () => {
        const countSpy = jest.spyOn(prisma.listing, 'count').mockResolvedValue(0);
        jest.spyOn(prisma.listing, 'findMany').mockResolvedValue([]);

        const response = await request(app).get('/api/v1/listings?q=موبايل');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(countSpy).toHaveBeenCalled();

        const firstCallArg = countSpy.mock.calls[0]?.[0] as { where?: { OR?: Array<Record<string, unknown>> } } | undefined;
        expect(firstCallArg?.where?.OR).toEqual(
            expect.arrayContaining([
                { titleAr: { contains: 'موبايل' } },
                { titleAr: { contains: 'جوال' } },
                { titleAr: { contains: 'هاتف' } },
            ]),
        );
    });

    it('GET /api/v1/listings/:id returns 404 when listing does not exist', async () => {
        jest.spyOn(prisma.listing, 'findFirst').mockResolvedValue(null);

        const response = await request(app).get('/api/v1/listings/99999');

        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('LISTING_NOT_FOUND');
    });

    it('POST /api/v1/listings creates listing with pending status for non-trusted user', async () => {
        const accessToken = signAccessToken({ userId: 50, role: 'USER', trustTier: 'VERIFIED' });

        jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({
            id: 50,
            role: 'USER',
            trustTier: 'VERIFIED',
            isActive: true,
            bannedAt: null,
        } as never);
        jest.spyOn(prisma.listing, 'count').mockResolvedValue(0);
        jest.spyOn(prisma.city, 'findFirst').mockResolvedValue({ id: 10 } as never);
        jest.spyOn(prisma.subcategory, 'findFirst').mockResolvedValue({
            id: 5,
            attributes: [{ id: 100, isRequired: true }],
        } as never);
        jest.spyOn(prisma.listing, 'create').mockResolvedValue({
            id: 101,
            titleAr: 'سيارة للبيع',
            titleEn: 'Car for sale',
            descriptionAr: 'وصف عربي طويل بما يكفي للاختبار ولإنشاء إعلان جديد',
            descriptionEn: 'Long enough english description for listing creation flow',
            priceAmount: 5000,
            currency: 'USD',
            negotiable: true,
            condition: 'USED',
            status: 'PENDING',
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
            locationLat: null,
            locationLng: null,
            phoneVisibility: false,
            whatsappVisibility: false,
            country: { id: 1, code: 'SY', nameAr: 'سوريا', nameEn: 'Syria' },
            city: { id: 10, nameAr: 'دمشق', nameEn: 'Damascus' },
            subcategory: { id: 5, slug: 'cars-for-sale', nameAr: 'سيارات', nameEn: 'Cars' },
            images: [{ urlOriginal: 'https://img.example/car1.jpg', sortOrder: 0, urlThumb: 'https://img.example/car1.jpg' }],
            attributeValues: [
                {
                    attributeDefinitionId: 100,
                    value: 'Toyota',
                    attribute: { nameAr: 'الماركة', nameEn: 'Brand' },
                },
            ],
        } as never);

        const response = await request(app)
            .post('/api/v1/listings')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
                subcategoryId: 5,
                countryId: 1,
                cityId: 10,
                titleAr: 'سيارة للبيع',
                titleEn: 'Car for sale',
                descriptionAr: 'وصف عربي طويل بما يكفي للاختبار ولإنشاء إعلان جديد',
                descriptionEn: 'Long enough english description for listing creation flow',
                priceAmount: 5000,
                currency: 'USD',
                negotiable: true,
                condition: 'USED',
                images: ['https://img.example/car1.jpg'],
                attributes: [{ attributeDefinitionId: 100, value: 'Toyota' }],
            });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data.status).toBe('PENDING');
        expect(response.body.data.images).toHaveLength(1);
    });

    it('PATCH /api/v1/listings/:id rejects updates by non-owner', async () => {
        const accessToken = signAccessToken({ userId: 77, role: 'USER', trustTier: 'VERIFIED' });
        jest.spyOn(prisma.listing, 'findUnique').mockResolvedValue({
            id: 101,
            userId: 50,
            countryId: 1,
            cityId: 10,
            subcategoryId: 5,
            status: 'ACTIVE',
        } as never);

        const response = await request(app)
            .patch('/api/v1/listings/101')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
                titleAr: 'تعديل غير مسموح',
            });

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('PATCH /api/v1/listings/:id allows owner update', async () => {
        const accessToken = signAccessToken({ userId: 50, role: 'USER', trustTier: 'TRUSTED' });
        jest.spyOn(prisma.listing, 'findUnique').mockResolvedValue({
            id: 101,
            userId: 50,
            countryId: 1,
            cityId: 10,
            subcategoryId: 5,
            status: 'ACTIVE',
        } as never);

        const txMock = {
            listing: {
                update: jest.fn().mockResolvedValue({}),
                findUnique: jest.fn().mockResolvedValue({
                    id: 101,
                    titleAr: 'عنوان معدل',
                    titleEn: 'Updated title',
                    descriptionAr: 'وصف عربي طويل بعد التعديل لاختبار التدفق',
                    descriptionEn: 'Long enough english description after update',
                    priceAmount: 5200,
                    currency: 'USD',
                    negotiable: true,
                    condition: 'USED',
                    status: 'ACTIVE',
                    createdAt: new Date('2026-01-01T00:00:00.000Z'),
                    locationLat: null,
                    locationLng: null,
                    phoneVisibility: false,
                    whatsappVisibility: false,
                    country: { id: 1, code: 'SY', nameAr: 'سوريا', nameEn: 'Syria' },
                    city: { id: 10, nameAr: 'دمشق', nameEn: 'Damascus' },
                    subcategory: { id: 5, slug: 'cars-for-sale', nameAr: 'سيارات', nameEn: 'Cars' },
                    images: [{ urlOriginal: 'https://img.example/car1.jpg', sortOrder: 0, urlThumb: 'https://img.example/car1.jpg' }],
                    attributeValues: [],
                }),
            },
            listingImage: {
                deleteMany: jest.fn().mockResolvedValue({}),
                createMany: jest.fn().mockResolvedValue({}),
            },
            listingAttributeValue: {
                deleteMany: jest.fn().mockResolvedValue({}),
                createMany: jest.fn().mockResolvedValue({}),
            },
        };
        jest.spyOn(prisma, '$transaction').mockImplementation(async (callback: unknown) => {
            return (callback as (client: typeof txMock) => Promise<unknown>)(txMock);
        });

        const response = await request(app)
            .patch('/api/v1/listings/101')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
                titleAr: 'عنوان معدل',
                titleEn: 'Updated title',
                descriptionAr: 'وصف عربي طويل بعد التعديل لاختبار التدفق',
                descriptionEn: 'Long enough english description after update',
                priceAmount: 5200,
                currency: 'USD',
            });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.title).toBe('عنوان معدل');
    });
});
