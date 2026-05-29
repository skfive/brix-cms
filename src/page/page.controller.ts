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
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { CreatePageDto } from './dto/create-page.dto';
import { UpdatePageDto } from './dto/update-page.dto';
import { PageResponse, PageService } from './page.service';

@Controller('pages')
export class PageController {
  constructor(private readonly pageService: PageService) {}

  /**
   * POST /pages — 페이지 생성 (인증 필요)
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @Request() req: { user: JwtPayload },
    @Body() dto: CreatePageDto,
  ): Promise<PageResponse> {
    return this.pageService.create(req.user.sub, dto);
  }

  /**
   * PATCH /pages/:id — 페이지 수정 (인증 필요, 작성자 본인)
   */
  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: { user: JwtPayload },
    @Body() dto: UpdatePageDto,
  ): Promise<PageResponse> {
    return this.pageService.update(id, req.user.sub, dto);
  }

  /**
   * DELETE /pages/:id — 페이지 삭제 (인증 필요, 작성자 본인)
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: { user: JwtPayload },
  ): Promise<void> {
    return this.pageService.remove(id, req.user.sub);
  }

  /**
   * GET /pages/:slug — 슬러그로 페이지 단건 조회 (퍼블릭)
   */
  @Get(':slug')
  async findBySlug(@Param('slug') slug: string): Promise<PageResponse> {
    return this.pageService.findBySlug(slug);
  }
}
