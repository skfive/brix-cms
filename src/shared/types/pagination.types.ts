/** 페이지네이션 응답 래퍼 */
export interface Pagination<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
