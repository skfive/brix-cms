/**
 * E2E 테스트 전역 환경 설정
 * jest-e2e.json 의 setupFiles 에서 로드 — 각 워커 프로세스 최초 실행
 * (globalSetup 은 별도 프로세스라 process.env 가 전파되지 않으므로 setupFiles 사용)
 */
process.env.DATABASE_URL = 'file:/tmp/brix-test-health-bf681.db';
