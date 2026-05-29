import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PublishStatus } from '../../shared/types/publish-status.types';

export class CreatePostDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  content?: string;

  /**
   * 미지정 시 title 에서 자동 생성
   */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  slug?: string;

  @IsOptional()
  @IsEnum(PublishStatus)
  status?: PublishStatus;
}
