import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { CommentResponse, CommentService } from './comment.service';
import { CreateCommentDto } from './dto/create-comment.dto';

@Controller('posts/:postId/comments')
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  /**
   * POST /posts/:postId/comments — 댓글 작성 (인증 필요)
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard)
  async create(
    @Param('postId', ParseIntPipe) postId: number,
    @Request() req: { user: JwtPayload },
    @Body() dto: CreateCommentDto,
  ): Promise<CommentResponse> {
    return this.commentService.create(req.user.sub, postId, dto);
  }

  /**
   * GET /posts/:postId/comments — 포스트별 댓글 목록 조회 (퍼블릭)
   */
  @Get()
  async findByPostId(
    @Param('postId', ParseIntPipe) postId: number,
  ): Promise<CommentResponse[]> {
    return this.commentService.findByPostId(postId);
  }
}
