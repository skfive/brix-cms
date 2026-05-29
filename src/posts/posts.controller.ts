import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { Pagination } from '../shared/types/pagination.types';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostResponse, PostsService } from './posts.service';

@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  /**
   * POST /posts — 포스트 생성 (인증 필요)
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @Request() req: { user: JwtPayload },
    @Body() dto: CreatePostDto,
  ): Promise<PostResponse> {
    return this.postsService.create(req.user.sub, dto);
  }

  /**
   * PATCH /posts/:id — 포스트 수정 (인증 필요, 작성자 본인)
   */
  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: { user: JwtPayload },
    @Body() dto: UpdatePostDto,
  ): Promise<PostResponse> {
    return this.postsService.update(id, req.user.sub, dto);
  }

  /**
   * DELETE /posts/:id — 포스트 삭제 (인증 필요, 작성자 본인)
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: { user: JwtPayload },
  ): Promise<void> {
    return this.postsService.remove(id, req.user.sub);
  }

  /**
   * GET /posts — 발행 포스트 목록 (퍼블릭, 페이지네이션)
   * ?page=1&pageSize=10
   */
  @Get()
  async findAll(
    @Query('page') rawPage = '1',
    @Query('pageSize') rawPageSize = '10',
  ): Promise<Pagination<PostResponse>> {
    const page = Math.max(1, parseInt(rawPage, 10) || 1);
    const pageSize = Math.max(1, parseInt(rawPageSize, 10) || 10);
    return this.postsService.findAll(page, pageSize);
  }

  /**
   * GET /posts/:slug — 슬러그로 발행 포스트 단건 조회 (퍼블릭)
   */
  @Get(':slug')
  async findBySlug(@Param('slug') slug: string): Promise<PostResponse> {
    return this.postsService.findPublishedBySlug(slug);
  }
}
