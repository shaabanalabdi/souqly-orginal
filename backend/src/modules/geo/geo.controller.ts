import type { NextFunction, Request, Response } from 'express';
import { getRequestLanguage } from '../../shared/utils/language.js';
import { getNearestCity, listCitiesByCountry, listCountries } from './geo.service.js';

export async function getCountriesController(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const lang = getRequestLanguage(req);
        const countries = await listCountries(lang);

        res.json({
            success: true,
            data: countries,
        });
    } catch (error) {
        next(error);
    }
}

export async function getCountryCitiesController(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const lang = getRequestLanguage(req);
        const result = await listCitiesByCountry(req.params.countryCode, lang);

        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        next(error);
    }
}

export async function getNearestCityController(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const lang = getRequestLanguage(req);
        const latitude = Number(req.query.lat);
        const longitude = Number(req.query.lng);
        const nearestCity = await getNearestCity(latitude, longitude, lang);

        res.json({
            success: true,
            data: nearestCity,
        });
    } catch (error) {
        next(error);
    }
}
