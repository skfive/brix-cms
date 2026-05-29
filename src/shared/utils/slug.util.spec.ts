import { generateSlug } from './slug.util';

describe('generateSlug', () => {
  it('영문 텍스트를 소문자 슬러그로 변환한다', () => {
    expect(generateSlug('Hello World')).toBe('hello-world');
  });

  it('한글 텍스트를 슬러그로 변환한다', () => {
    expect(generateSlug('안녕 세상')).toBe('안녕-세상');
  });

  it('특수문자를 제거한다', () => {
    expect(generateSlug('Hello! World@#$')).toBe('hello-world');
  });

  it('연속 공백을 단일 하이픈으로 변환한다', () => {
    expect(generateSlug('Hello   World')).toBe('hello-world');
  });

  it('앞뒤 공백을 처리한다', () => {
    expect(generateSlug('  Hello World  ')).toBe('hello-world');
  });

  it('한글과 영문 혼합 텍스트를 처리한다', () => {
    expect(generateSlug('Next.js 입문 가이드')).toBe('nextjs-입문-가이드');
  });

  it('연속 하이픈(중복)을 단일 하이픈으로 정규화한다', () => {
    expect(generateSlug('foo--bar')).toBe('foo-bar');
  });

  it('빈 문자열 입력 시 빈 문자열을 반환한다', () => {
    expect(generateSlug('')).toBe('');
  });

  it('숫자를 포함한 텍스트를 처리한다', () => {
    expect(generateSlug('Top 10 Recipes')).toBe('top-10-recipes');
  });

  it('앞뒤 특수문자가 붙은 텍스트의 하이픈을 정리한다', () => {
    expect(generateSlug('!Hello World!')).toBe('hello-world');
  });

  it('언더스코어를 하이픈으로 변환한다', () => {
    expect(generateSlug('hello_world')).toBe('hello-world');
  });

  it('한글 제목만 있을 때 슬러그를 생성한다', () => {
    expect(generateSlug('프리즈마 모델 설계')).toBe('프리즈마-모델-설계');
  });
});
