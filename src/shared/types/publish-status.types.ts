/**
 * 콘텐츠 발행 상태 enum
 *
 * SQLite 는 native enum 을 지원하지 않으므로 Prisma 스키마에서는 String 으로 저장하며,
 * 앱 레벨에서 이 TypeScript enum 을 사용하여 유효성을 검증한다.
 */
export enum PublishStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
}

/** 발행 상태 유니온 타입 (리터럴 타입이 필요한 경우 사용) */
export type PublishStatusType = keyof typeof PublishStatus;
