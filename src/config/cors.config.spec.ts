import {
  ALLOWED_HEADERS,
  ALLOWED_METHODS,
  DEFAULT_ALLOWED_ORIGINS,
  buildCorsOptions,
  parseAllowedOrigins,
} from './cors.config';

describe('cors.config (BF-727)', () => {
  describe('parseAllowedOrigins', () => {
    it('undefined 이면 dev 기본 origin 배열을 반환한다', () => {
      expect(parseAllowedOrigins(undefined)).toEqual([
        'http://localhost:3000',
        'http://localhost:3001',
      ]);
    });

    it('빈 문자열/공백이면 dev 기본 origin 배열을 반환한다', () => {
      expect(parseAllowedOrigins('')).toEqual([...DEFAULT_ALLOWED_ORIGINS]);
      expect(parseAllowedOrigins('   ')).toEqual([...DEFAULT_ALLOWED_ORIGINS]);
    });

    it('comma-separated 문자열을 trim 하여 배열로 파싱한다', () => {
      expect(
        parseAllowedOrigins('http://localhost:3000, http://localhost:3001'),
      ).toEqual(['http://localhost:3000', 'http://localhost:3001']);
    });

    it('빈 항목(연속 콤마/후행 콤마)은 제거한다', () => {
      expect(parseAllowedOrigins('http://a.com,,http://b.com,')).toEqual([
        'http://a.com',
        'http://b.com',
      ]);
    });

    it('기본값 반환 시 원본 상수를 복사한다(불변성 보장)', () => {
      const result = parseAllowedOrigins(undefined);
      result.push('http://mutated');
      expect(DEFAULT_ALLOWED_ORIGINS).not.toContain('http://mutated');
    });
  });

  describe('buildCorsOptions', () => {
    it('AC1/AC3: 기본 origin 에 localhost:3001 과 localhost:3000 이 모두 포함된다', () => {
      const options = buildCorsOptions();
      expect(options.origin).toEqual([
        'http://localhost:3000',
        'http://localhost:3001',
      ]);
    });

    it('AC2: preflight 성공 상태코드 204 를 지정한다', () => {
      expect(buildCorsOptions().optionsSuccessStatus).toBe(204);
    });

    it('AC2: OPTIONS 를 포함한 메서드 화이트리스트를 지정한다', () => {
      const { methods } = buildCorsOptions();
      expect(methods).toEqual([...ALLOWED_METHODS]);
      expect(methods).toContain('OPTIONS');
    });

    it('AC2: Authorization/Content-Type 등 허용 헤더를 지정한다', () => {
      const { allowedHeaders } = buildCorsOptions();
      expect(allowedHeaders).toEqual([...ALLOWED_HEADERS]);
      expect(allowedHeaders).toContain('Authorization');
      expect(allowedHeaders).toContain('Content-Type');
    });

    it('credentials 를 true 로 설정한다(쿠키/Authorization 동반 요청 허용)', () => {
      expect(buildCorsOptions().credentials).toBe(true);
    });

    it('환경변수 raw 값으로 origin 화이트리스트를 override 한다', () => {
      const options = buildCorsOptions('https://app.example.com');
      expect(options.origin).toEqual(['https://app.example.com']);
    });
  });
});
