/**
 * 텍스트를 URL 안전 슬러그로 변환한다.
 *
 * 변환 규칙:
 * 1. 앞뒤 공백 제거
 * 2. 공백·언더스코어·슬래시를 하이픈으로 치환
 * 3. 유니코드 문자(한글 포함)·숫자·하이픈 이외의 문자 제거
 * 4. 소문자 변환 (ASCII/라틴 계열)
 * 5. 연속 하이픈을 단일 하이픈으로 정규화
 * 6. 앞뒤 하이픈 제거
 */
export function generateSlug(text: string): string {
  return text
    .trim()
    .replace(/[\s_/\\]+/g, '-')
    .replace(/[^\p{L}\p{N}-]/gu, '')
    .toLowerCase()
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}
