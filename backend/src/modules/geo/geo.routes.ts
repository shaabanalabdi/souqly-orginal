import { Router } from 'express';
import { validate } from '../../shared/middleware/validate.js';
import {
    getCountriesController,
    getCountryCitiesController,
    getNearestCityController,
} from './geo.controller.js';
import { countryCodeParamsSchema, nearestCityQuerySchema } from './geo.validation.js';

const geoRoutes = Router();

geoRoutes.get('/countries', getCountriesController);
geoRoutes.get(
    '/countries/:countryCode/cities',
    validate({ params: countryCodeParamsSchema }),
    getCountryCitiesController,
);
geoRoutes.get('/nearest-city', validate({ query: nearestCityQuerySchema }), getNearestCityController);

export default geoRoutes;
