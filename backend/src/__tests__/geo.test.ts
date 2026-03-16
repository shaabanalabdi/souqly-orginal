import request from 'supertest';
import app from '../app.js';
import { prisma } from '../shared/utils/prisma.js';

describe('Geo routes', () => {
    it('GET /api/v1/geo/countries returns localized country data', async () => {
        jest.spyOn(prisma.country, 'findMany').mockResolvedValue([
            {
                id: 1,
                code: 'SY',
                nameAr: 'Syria Arabic',
                nameEn: 'Syria',
                currencyCode: 'SYP',
                currencySymbol: 'SYP',
                phoneCode: '+963',
            },
        ] as never);

        const response = await request(app).get('/api/v1/geo/countries?lang=en');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual([
            {
                id: 1,
                code: 'SY',
                name: 'Syria',
                currencyCode: 'SYP',
                currencySymbol: 'SYP',
                phoneCode: '+963',
            },
        ]);
    });

    it('GET /api/v1/geo/countries/:code/cities returns 404 for unknown country', async () => {
        jest.spyOn(prisma.country, 'findFirst').mockResolvedValue(null);

        const response = await request(app).get('/api/v1/geo/countries/XX/cities');

        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('COUNTRY_NOT_FOUND');
    });

    it('GET /api/v1/geo/nearest-city returns nearest city by coordinates', async () => {
        jest.spyOn(prisma.city, 'findMany').mockResolvedValue([
            {
                id: 1,
                nameAr: 'Damascus Arabic',
                nameEn: 'Damascus',
                latitude: 33.5138,
                longitude: 36.2765,
                country: {
                    id: 1,
                    code: 'SY',
                    nameAr: 'Syria Arabic',
                    nameEn: 'Syria',
                    currencyCode: 'SYP',
                    currencySymbol: 'SYP',
                },
            },
            {
                id: 2,
                nameAr: 'Baghdad Arabic',
                nameEn: 'Baghdad',
                latitude: 33.3152,
                longitude: 44.3661,
                country: {
                    id: 2,
                    code: 'IQ',
                    nameAr: 'Iraq Arabic',
                    nameEn: 'Iraq',
                    currencyCode: 'IQD',
                    currencySymbol: 'IQD',
                },
            },
        ] as never);

        const response = await request(app).get('/api/v1/geo/nearest-city?lat=33.52&lng=36.28&lang=en');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.city.name).toBe('Damascus');
        expect(response.body.data.country.code).toBe('SY');
        expect(typeof response.body.data.distanceKm).toBe('number');
    });
});
