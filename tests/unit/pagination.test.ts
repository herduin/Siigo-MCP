import { describe, it, expect } from 'vitest';
import { normalizePaginationParams, createPaginatedResponse } from '../../src/utils/pagination';

describe('Pagination Utils', () => {
  describe('normalizePaginationParams', () => {
    it('should use defaults when no params provided', () => {
      const result = normalizePaginationParams({});
      expect(result).toEqual({ page: 1, pageSize: 20 });
    });

    it('should use provided page and pageSize', () => {
      const result = normalizePaginationParams({ page: 3, pageSize: 50 });
      expect(result).toEqual({ page: 3, pageSize: 50 });
    });

    it('should convert offset/limit to page/pageSize', () => {
      const result = normalizePaginationParams({ offset: 40, limit: 20 });
      expect(result).toEqual({ page: 3, pageSize: 20 });
    });

    it('should enforce maximum pageSize', () => {
      const result = normalizePaginationParams({ pageSize: 200 });
      expect(result.pageSize).toBe(100);
    });

    it('should enforce minimum page', () => {
      const result = normalizePaginationParams({ page: 0 });
      expect(result.page).toBe(1);
    });
  });

  describe('createPaginatedResponse', () => {
    it('should create correct pagination metadata', () => {
      const data = [1, 2, 3, 4, 5];
      const result = createPaginatedResponse(data, 2, 5, 15);

      expect(result.data).toEqual(data);
      expect(result.pagination).toEqual({
        page: 2,
        pageSize: 5,
        total: 15,
        totalPages: 3,
        hasNextPage: true,
        hasPreviousPage: true,
      });
    });

    it('should indicate no next page on last page', () => {
      const result = createPaginatedResponse([], 3, 5, 15);
      expect(result.pagination.hasNextPage).toBe(false);
    });

    it('should indicate no previous page on first page', () => {
      const result = createPaginatedResponse([], 1, 5, 15);
      expect(result.pagination.hasPreviousPage).toBe(false);
    });
  });
});
