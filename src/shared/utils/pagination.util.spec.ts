import { createPagination, calcSkip } from './pagination.util';

describe('createPagination', () => {
  it('totalPages 를 올바르게 계산한다', () => {
    const result = createPagination(['a', 'b', 'c'], 10, 1, 3);
    expect(result.totalPages).toBe(4); // ceil(10/3) = 4
  });

  it('반환 객체가 올바른 구조를 가진다', () => {
    const data = [1, 2];
    const result = createPagination(data, 20, 2, 10);
    expect(result).toEqual({
      data: [1, 2],
      total: 20,
      page: 2,
      pageSize: 10,
      totalPages: 2,
    });
  });

  it('전체 아이템 수가 pageSize 의 배수일 때 올바르게 계산한다', () => {
    const result = createPagination([], 10, 1, 5);
    expect(result.totalPages).toBe(2);
  });

  it('전체 아이템이 0일 때 totalPages 가 0이다', () => {
    const result = createPagination([], 0, 1, 10);
    expect(result.totalPages).toBe(0);
  });

  it('마지막 페이지의 부분 데이터도 올바르게 처리한다', () => {
    const result = createPagination([1], 11, 3, 5);
    expect(result.totalPages).toBe(3); // ceil(11/5) = 3
    expect(result.page).toBe(3);
  });

  it('제네릭 타입으로 객체 배열도 처리한다', () => {
    const items = [{ id: 1, name: 'foo' }];
    const result = createPagination(items, 1, 1, 10);
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toEqual({ id: 1, name: 'foo' });
  });
});

describe('calcSkip', () => {
  it('첫 번째 페이지의 skip 은 0이다', () => {
    expect(calcSkip(1, 10)).toBe(0);
  });

  it('두 번째 페이지의 skip 은 pageSize 와 같다', () => {
    expect(calcSkip(2, 10)).toBe(10);
  });

  it('세 번째 페이지의 skip 을 올바르게 계산한다', () => {
    expect(calcSkip(3, 5)).toBe(10);
  });

  it('다양한 pageSize 에서 올바르게 계산한다', () => {
    expect(calcSkip(4, 20)).toBe(60);
  });
});
