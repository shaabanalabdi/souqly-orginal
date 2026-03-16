import type { AttributeType, Prisma } from '@prisma/client';
import { ApiError } from '../../shared/middleware/errorHandler.js';
import { prisma } from '../../shared/utils/prisma.js';
import type { AppLanguage } from '../../shared/utils/language.js';

export interface CategoryDto {
    id: number;
    slug: string;
    icon: string;
    name: string;
    subcategoryCount: number;
}

export interface SubcategoryDto {
    id: number;
    slug: string;
    name: string;
    attributesCount: number;
}

export interface AttributeDto {
    id: number;
    slug: string;
    name: string;
    type: AttributeType;
    isRequired: boolean;
    isFilterable: boolean;
    options: string[];
}

function localizeName(entity: { nameAr: string; nameEn: string }, lang: AppLanguage): string {
    return lang === 'ar' ? entity.nameAr : entity.nameEn;
}

function extractStringOptions(options: Prisma.JsonValue | null): string[] {
    if (!Array.isArray(options)) {
        return [];
    }

    return options.filter((item): item is string => typeof item === 'string');
}

export async function listCategories(lang: AppLanguage): Promise<CategoryDto[]> {
    const categories = await prisma.category.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        select: {
            id: true,
            slug: true,
            icon: true,
            nameAr: true,
            nameEn: true,
            subcategories: {
                where: { isActive: true },
                select: { id: true },
            },
        },
    });

    return categories.map((category) => ({
        id: category.id,
        slug: category.slug,
        icon: category.icon,
        name: localizeName(category, lang),
        subcategoryCount: category.subcategories.length,
    }));
}

export async function listSubcategoriesByCategorySlug(
    categorySlug: string,
    lang: AppLanguage,
): Promise<{ category: { id: number; slug: string; name: string }; subcategories: SubcategoryDto[] }> {
    const category = await prisma.category.findFirst({
        where: {
            slug: categorySlug,
            isActive: true,
        },
        select: {
            id: true,
            slug: true,
            nameAr: true,
            nameEn: true,
            subcategories: {
                where: { isActive: true },
                orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
                select: {
                    id: true,
                    slug: true,
                    nameAr: true,
                    nameEn: true,
                    attributes: {
                        select: { id: true },
                    },
                },
            },
        },
    });

    if (!category) {
        throw new ApiError(404, 'CATEGORY_NOT_FOUND', `Category '${categorySlug}' not found.`);
    }

    return {
        category: {
            id: category.id,
            slug: category.slug,
            name: localizeName(category, lang),
        },
        subcategories: category.subcategories.map((subcategory) => ({
            id: subcategory.id,
            slug: subcategory.slug,
            name: localizeName(subcategory, lang),
            attributesCount: subcategory.attributes.length,
        })),
    };
}

export async function listAttributesBySubcategorySlug(
    subcategorySlug: string,
    lang: AppLanguage,
): Promise<{
    subcategory: { id: number; slug: string; name: string };
    attributes: AttributeDto[];
}> {
    const subcategory = await prisma.subcategory.findFirst({
        where: {
            slug: subcategorySlug,
            isActive: true,
        },
        select: {
            id: true,
            slug: true,
            nameAr: true,
            nameEn: true,
            attributes: {
                orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
                select: {
                    id: true,
                    slug: true,
                    nameAr: true,
                    nameEn: true,
                    type: true,
                    isRequired: true,
                    isFilterable: true,
                    options: true,
                },
            },
        },
    });

    if (!subcategory) {
        throw new ApiError(404, 'SUBCATEGORY_NOT_FOUND', `Subcategory '${subcategorySlug}' not found.`);
    }

    return {
        subcategory: {
            id: subcategory.id,
            slug: subcategory.slug,
            name: localizeName(subcategory, lang),
        },
        attributes: subcategory.attributes.map((attribute) => ({
            id: attribute.id,
            slug: attribute.slug,
            name: localizeName(attribute, lang),
            type: attribute.type,
            isRequired: attribute.isRequired,
            isFilterable: attribute.isFilterable,
            options: extractStringOptions(attribute.options),
        })),
    };
}
