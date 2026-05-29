import { Pagination } from '../types/pagination.types';

/**
 * 페이지네이션 응답 객체를 생성한다.
 *
 * @param data     현재 페이지 데이터
 * @param total    전체 아이템 수
 * @param page     현재 페이지 번호 (1-based)
 * @param pageSize 페이지당 아이템 수
 */
export function createPagination<T>(
  data: T[],
  total: number,
  page: number,
  pageSize: number,
): Pagination<T> {
  return {
    data,
    total,
    page,
    pageSize,
    totalPages: pageSize > 0 ? Math.ceil(total / pageSize) : 0,
  };
}

/**
 * Prisma `skip` 값을 계산한다.
 *
 * @param page     현재 페이지 번호 (1-based)
 * @param pageSize 페이지당 아이템 수
 */
export function calcSkip(page: number, pageSize: number): number {
  return (page - 1) * pageSize;
}
