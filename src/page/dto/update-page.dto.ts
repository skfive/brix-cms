import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PublishStatus } from '../../shared/types/publish-status.types';

/**
 * 페이지 수정 DTO — 모든 필드 선택적 (수동 PartialType)
 * @nestjs/mapped-types 미설치 환경 대응
 */
export class UpdatePageDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  slug?: string;

  @IsOptional()
  @IsEnum(PublishStatus)
  status?: PublishStatus;
}
