import type { NextFunction, Request, Response } from 'express';
import { getRequestLanguage } from '../../shared/utils/language.js';
import {
    listAttributesBySubcategorySlug,
    listCategories,
    listSubcategoriesByCategorySlug,
} from './category.service.js';

export async function getCategoriesController(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const lang = getRequestLanguage(req);
        const categories = await listCategories(lang);

        res.json({
            success: true,
            data: categories,
        });
    } catch (error) {
        next(error);
    }
}

export async function getSubcategoriesByCategoryController(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const lang = getRequestLanguage(req);
        const payload = await listSubcategoriesByCategorySlug(req.params.categorySlug, lang);

        res.json({
            success: true,
            data: payload,
        });
    } catch (error) {
        next(error);
    }
}

export async function getAttributesBySubcategoryController(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const lang = getRequestLanguage(req);
        const payload = await listAttributesBySubcategorySlug(req.params.subcategorySlug, lang);

        res.json({
            success: true,
            data: payload,
        });
    } catch (error) {
        next(error);
    }
}
