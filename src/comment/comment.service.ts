import { Injectable, NotFoundException } from '@nestjs/common';
import type { Comment } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthorSummary } from '../shared/types/author.types';
import { CreateCommentDto } from './dto/create-comment.dto';

export interface CommentResponse {
  id: number;
  content: string;
  postId: number;
  author: AuthorSummary;
  createdAt: Date;
  updatedAt: Date;
}

type CommentWithAuthor = Comment & {
  author: { id: number; email: string; role: string };
};

const AUTHOR_SELECT = { id: true, email: true, role: true } as const;

function toCommentResponse(comment: CommentWithAuthor): CommentResponse {
  return {
    id: comment.id,
    content: comment.content,
    postId: comment.postId,
    author: {
      id: comment.author.id,
      email: comment.author.email,
      role: comment.author.role,
    },
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
  };
}

@Injectable()
export class CommentService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 댓글 작성. 포스트 존재 여부 먼저 확인.
   */
  async create(
    authorId: number,
    postId: number,
    dto: CreateCommentDto,
  ): Promise<CommentResponse> {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) {
      throw new NotFoundException(`포스트 ID ${postId} 를 찾을 수 없습니다.`);
    }

    const comment = await this.prisma.comment.create({
      data: {
        content: dto.content,
        postId,
        authorId,
      },
      include: { author: { select: AUTHOR_SELECT } },
    });

    return toCommentResponse(comment);
  }

  /**
   * 포스트별 댓글 목록 조회. 포스트 존재 여부 먼저 확인.
   */
  async findByPostId(postId: number): Promise<CommentResponse[]> {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) {
      throw new NotFoundException(`포스트 ID ${postId} 를 찾을 수 없습니다.`);
    }

    const comments = await this.prisma.comment.findMany({
      where: { postId },
      include: { author: { select: AUTHOR_SELECT } },
      orderBy: { createdAt: 'asc' },
    });

    return comments.map(toCommentResponse);
  }
}
