import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Post } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthorSummary } from '../shared/types/author.types';
import { PublishStatus } from '../shared/types/publish-status.types';
import { Pagination } from '../shared/types/pagination.types';
import { calcSkip, createPagination } from '../shared/utils/pagination.util';
import { generateSlug } from '../shared/utils/slug.util';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';

export interface PostResponse {
  id: number;
  title: string;
  slug: string;
  content: string | null;
  status: PublishStatus;
  author: AuthorSummary;
  createdAt: Date;
  updatedAt: Date;
}

type PostWithAuthor = Post & {
  author: { id: number; email: string; role: string };
};

const AUTHOR_SELECT = { id: true, email: true, role: true } as const;

function toPostResponse(post: PostWithAuthor): PostResponse {
  return {
    id: post.id,
    title: post.title,
    slug: post.slug,
    content: post.content,
    status: post.status as PublishStatus,
    author: {
      id: post.author.id,
      email: post.author.email,
      role: post.author.role,
    },
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
  };
}

@Injectable()
export class PostsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 포스트 생성.
   * slug 미지정 시 title 에서 자동 생성.
   */
  async create(authorId: number, dto: CreatePostDto): Promise<PostResponse> {
    const slug = dto.slug ?? generateSlug(dto.title);

    const existing = await this.prisma.post.findUnique({ where: { slug } });
    if (existing) {
      throw new ConflictException(`슬러그 '${slug}' 가 이미 존재합니다.`);
    }

    const post = await this.prisma.post.create({
      data: {
        title: dto.title,
        content: dto.content ?? null,
        slug,
        status: dto.status ?? PublishStatus.DRAFT,
        authorId,
      },
      include: { author: { select: AUTHOR_SELECT } },
    });

    return toPostResponse(post);
  }

  /**
   * 포스트 수정. 작성자 본인만 수정 가능.
   */
  async update(
    id: number,
    authorId: number,
    dto: UpdatePostDto,
  ): Promise<PostResponse> {
    const post = await this.prisma.post.findUnique({
      where: { id },
      include: { author: { select: AUTHOR_SELECT } },
    });

    if (!post) {
      throw new NotFoundException(`포스트 ID ${id} 를 찾을 수 없습니다.`);
    }
    if (post.authorId !== authorId) {
      throw new ForbiddenException(
        '본인이 작성한 포스트만 수정할 수 있습니다.',
      );
    }

    // slug 변경 시 중복 검사
    if (dto.slug !== undefined && dto.slug !== post.slug) {
      const conflicting = await this.prisma.post.findUnique({
        where: { slug: dto.slug },
      });
      if (conflicting) {
        throw new ConflictException(`슬러그 '${dto.slug}' 가 이미 존재합니다.`);
      }
    }

    const updated = await this.prisma.post.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.content !== undefined && { content: dto.content }),
        ...(dto.slug !== undefined && { slug: dto.slug }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
      include: { author: { select: AUTHOR_SELECT } },
    });

    return toPostResponse(updated);
  }

  /**
   * 포스트 삭제. 작성자 본인만 삭제 가능.
   */
  async remove(id: number, authorId: number): Promise<void> {
    const post = await this.prisma.post.findUnique({ where: { id } });

    if (!post) {
      throw new NotFoundException(`포스트 ID ${id} 를 찾을 수 없습니다.`);
    }
    if (post.authorId !== authorId) {
      throw new ForbiddenException(
        '본인이 작성한 포스트만 삭제할 수 있습니다.',
      );
    }

    await this.prisma.post.delete({ where: { id } });
  }

  /**
   * 슬러그로 발행(PUBLISHED) 포스트 단건 조회. 인증 불필요.
   */
  async findPublishedBySlug(slug: string): Promise<PostResponse> {
    const post = await this.prisma.post.findFirst({
      where: { slug, status: PublishStatus.PUBLISHED },
      include: { author: { select: AUTHOR_SELECT } },
    });

    if (!post) {
      throw new NotFoundException(
        `슬러그 '${slug}' 에 해당하는 발행 포스트를 찾을 수 없습니다.`,
      );
    }

    return toPostResponse(post);
  }

  /**
   * 발행된 포스트 목록 조회 (페이지네이션). 공유 헬퍼 사용.
   */
  async findAll(
    page: number,
    pageSize: number,
  ): Promise<Pagination<PostResponse>> {
    const skip = calcSkip(page, pageSize);

    const [posts, total] = await this.prisma.$transaction([
      this.prisma.post.findMany({
        where: { status: PublishStatus.PUBLISHED },
        include: { author: { select: AUTHOR_SELECT } },
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.post.count({ where: { status: PublishStatus.PUBLISHED } }),
    ]);

    return createPagination(posts.map(toPostResponse), total, page, pageSize);
  }
}
