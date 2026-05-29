import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Page } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PublishStatus } from '../shared/types/publish-status.types';
import { generateSlug } from '../shared/utils/slug.util';
import { CreatePageDto } from './dto/create-page.dto';
import { UpdatePageDto } from './dto/update-page.dto';

export interface PageResponse {
  id: number;
  title: string;
  slug: string;
  content: string | null;
  status: string;
  author: { id: number; email: string; role: string };
  createdAt: Date;
  updatedAt: Date;
}

type PageWithAuthor = Page & {
  author: { id: number; email: string; role: string };
};

const AUTHOR_SELECT = { id: true, email: true, role: true } as const;

function toPageResponse(page: PageWithAuthor): PageResponse {
  return {
    id: page.id,
    title: page.title,
    slug: page.slug,
    content: page.content,
    status: page.status,
    author: {
      id: page.author.id,
      email: page.author.email,
      role: page.author.role,
    },
    createdAt: page.createdAt,
    updatedAt: page.updatedAt,
  };
}

@Injectable()
export class PageService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 페이지 생성.
   * slug 미지정 시 title 에서 자동 생성.
   */
  async create(authorId: number, dto: CreatePageDto): Promise<PageResponse> {
    const slug = dto.slug ?? generateSlug(dto.title);

    const existing = await this.prisma.page.findUnique({ where: { slug } });
    if (existing) {
      throw new ConflictException(`슬러그 '${slug}' 가 이미 존재합니다.`);
    }

    const page = await this.prisma.page.create({
      data: {
        title: dto.title,
        content: dto.content ?? null,
        slug,
        status: dto.status ?? PublishStatus.DRAFT,
        authorId,
      },
      include: { author: { select: AUTHOR_SELECT } },
    });

    return toPageResponse(page);
  }

  /**
   * 페이지 수정. 작성자 본인만 수정 가능.
   */
  async update(
    id: number,
    authorId: number,
    dto: UpdatePageDto,
  ): Promise<PageResponse> {
    const page = await this.prisma.page.findUnique({
      where: { id },
      include: { author: { select: AUTHOR_SELECT } },
    });

    if (!page) {
      throw new NotFoundException(`페이지 ID ${id} 를 찾을 수 없습니다.`);
    }
    if (page.authorId !== authorId) {
      throw new ForbiddenException(
        '본인이 작성한 페이지만 수정할 수 있습니다.',
      );
    }

    // slug 변경 시 중복 검사
    if (dto.slug !== undefined && dto.slug !== page.slug) {
      const conflicting = await this.prisma.page.findUnique({
        where: { slug: dto.slug },
      });
      if (conflicting) {
        throw new ConflictException(`슬러그 '${dto.slug}' 가 이미 존재합니다.`);
      }
    }

    const updated = await this.prisma.page.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.content !== undefined && { content: dto.content }),
        ...(dto.slug !== undefined && { slug: dto.slug }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
      include: { author: { select: AUTHOR_SELECT } },
    });

    return toPageResponse(updated);
  }

  /**
   * 페이지 삭제. 작성자 본인만 삭제 가능.
   */
  async remove(id: number, authorId: number): Promise<void> {
    const page = await this.prisma.page.findUnique({ where: { id } });

    if (!page) {
      throw new NotFoundException(`페이지 ID ${id} 를 찾을 수 없습니다.`);
    }
    if (page.authorId !== authorId) {
      throw new ForbiddenException(
        '본인이 작성한 페이지만 삭제할 수 있습니다.',
      );
    }

    await this.prisma.page.delete({ where: { id } });
  }

  /**
   * 슬러그로 페이지 단건 조회. 인증 불필요.
   */
  async findBySlug(slug: string): Promise<PageResponse> {
    const page = await this.prisma.page.findUnique({
      where: { slug },
      include: { author: { select: AUTHOR_SELECT } },
    });

    if (!page) {
      throw new NotFoundException(
        `슬러그 '${slug}' 에 해당하는 페이지를 찾을 수 없습니다.`,
      );
    }

    return toPageResponse(page);
  }
}
