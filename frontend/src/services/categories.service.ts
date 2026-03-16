import { requestData } from './client';
import type { Category, CategorySubcategories, SubcategoryAttributes } from '../types/domain';

export const categoriesService = {
  listCategories() {
    return requestData<Category[]>({
      method: 'GET',
      url: '/categories',
    });
  },

  listSubcategories(categorySlug: string) {
    return requestData<CategorySubcategories>({
      method: 'GET',
      url: `/categories/${categorySlug}/subcategories`,
    });
  },

  listAttributes(subcategorySlug: string) {
    return requestData<SubcategoryAttributes>({
      method: 'GET',
      url: `/subcategories/${subcategorySlug}/attributes`,
    });
  },
};
