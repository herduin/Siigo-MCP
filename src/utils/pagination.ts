export interface PaginationParams {
  page?: number;
  pageSize?: number;
  limit?: number;
  offset?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export function normalizePaginationParams(params: PaginationParams): {
  page: number;
  pageSize: number;
} {
  let page = params.page || 1;
  let pageSize = params.pageSize || 20;

  // Support offset/limit style pagination
  if (params.offset !== undefined || params.limit !== undefined) {
    const offset = params.offset || 0;
    const limit = params.limit || 20;
    page = Math.floor(offset / limit) + 1;
    pageSize = limit;
  }

  // Ensure reasonable bounds
  page = Math.max(1, page);
  pageSize = Math.min(Math.max(1, pageSize), 100);

  return { page, pageSize };
}

export function createPaginatedResponse<T>(
  data: T[],
  page: number,
  pageSize: number,
  total: number
): PaginatedResponse<T> {
  const totalPages = Math.ceil(total / pageSize);

  return {
    data,
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  };
}
