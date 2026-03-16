import request from 'supertest';
import app from '../app.js';
import { prisma } from '../shared/utils/prisma.js';

describe('Category routes', () => {
    it('GET /api/v1/categories returns localized categories', async () => {
        jest.spyOn(prisma.category, 'findMany').mockResolvedValue([
            {
                id: 1,
                slug: 'vehicles',
                icon: 'car',
                nameAr: 'Vehicles Arabic',
                nameEn: 'Vehicles',
                subcategories: [{ id: 11 }, { id: 12 }],
            },
        ] as never);

        const response = await request(app).get('/api/v1/categories?lang=en');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual([
            {
                id: 1,
                slug: 'vehicles',
                icon: 'car',
                name: 'Vehicles',
                subcategoryCount: 2,
            },
        ]);
    });

    it('GET /api/v1/categories/:slug/subcategories returns 404 when category missing', async () => {
        jest.spyOn(prisma.category, 'findFirst').mockResolvedValue(null);

        const response = await request(app).get('/api/v1/categories/unknown/subcategories');

        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('CATEGORY_NOT_FOUND');
    });

    it('GET /api/v1/subcategories/:slug/attributes returns attributes and options', async () => {
        jest.spyOn(prisma.subcategory, 'findFirst').mockResolvedValue({
            id: 11,
            slug: 'cars-for-sale',
            nameAr: 'Cars Arabic',
            nameEn: 'Cars for Sale',
            attributes: [
                {
                    id: 101,
                    slug: 'brand',
                    nameAr: 'Brand Arabic',
                    nameEn: 'Brand',
                    type: 'SELECT',
                    isRequired: true,
                    isFilterable: true,
                    options: ['Toyota', 'Kia'],
                },
            ],
        } as never);

        const response = await request(app).get('/api/v1/subcategories/cars-for-sale/attributes?lang=en');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.subcategory.name).toBe('Cars for Sale');
        expect(response.body.data.attributes[0].options).toEqual(['Toyota', 'Kia']);
    });
});
