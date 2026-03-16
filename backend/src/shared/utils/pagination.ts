// FILE: backend/src/shared/utils/pagination.ts

export interface PaginationParams {
    page: number;
    limit: number;
}

export interface PaginationMeta {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
}

/** Parse page/limit from query with safe defaults */
export function parsePagination(query: Record<string, unknown>): PaginationParams {
    const page = Math.max(1, parseInt(String(query.page || '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(query.limit || '20'), 10) || 20));
    return { page, limit };
}

/** Build pagination meta from total count */
export function buildPaginationMeta(total: number, params: PaginationParams): PaginationMeta {
    const totalPages = Math.ceil(total / params.limit);
    return {
        page: params.page,
        limit: params.limit,
        total,
        totalPages,
        hasNext: params.page < totalPages,
        hasPrev: params.page > 1,
    };
}

/** Get Prisma skip value */
export function getSkip(params: PaginationParams): number {
    return (params.page - 1) * params.limit;
}
