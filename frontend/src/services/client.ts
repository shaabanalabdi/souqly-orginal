import type { AxiosRequestConfig } from 'axios';
import { http } from './http';
import type { ApiSuccessResponse, PaginatedData } from '../types/api';

export async function requestData<T>(config: AxiosRequestConfig): Promise<T> {
  const response = await http.request<ApiSuccessResponse<T>>(config);
  return response.data.data;
}

export async function requestPaginated<T>(config: AxiosRequestConfig): Promise<PaginatedData<T>> {
  const response = await http.request<ApiSuccessResponse<T[]>>(config);
  return {
    items: response.data.data,
    meta: response.data.meta ?? {
      page: 1,
      limit: response.data.data.length,
      total: response.data.data.length,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    },
  };
}
