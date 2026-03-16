import { Router } from 'express';
import { validate } from '../../shared/middleware/validate.js';
import {
    getAttributesBySubcategoryController,
    getCategoriesController,
    getSubcategoriesByCategoryController,
} from './category.controller.js';
import { categorySlugParamsSchema, subcategorySlugParamsSchema } from './category.validation.js';

const categoryRoutes = Router();

categoryRoutes.get('/categories', getCategoriesController);
categoryRoutes.get(
    '/categories/:categorySlug/subcategories',
    validate({ params: categorySlugParamsSchema }),
    getSubcategoriesByCategoryController,
);
categoryRoutes.get(
    '/subcategories/:subcategorySlug/attributes',
    validate({ params: subcategorySlugParamsSchema }),
    getAttributesBySubcategoryController,
);

export default categoryRoutes;
