import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CommentService } from './comment.service';
import { PrismaService } from '../prisma/prisma.service';

const NOW = new Date('2026-01-01T00:00:00Z');

const mockAuthor = { id: 1, email: 'author@example.com', role: 'user' };
const mockPost = {
  id: 10,
  title: '테스트 포스트',
  slug: 'test-post',
  content: null,
  status: 'PUBLISHED',
  authorId: 1,
  createdAt: NOW,
  updatedAt: NOW,
};
const mockComment = {
  id: 100,
  content: '테스트 댓글입니다.',
  postId: 10,
  authorId: 1,
  author: mockAuthor,
  createdAt: NOW,
  updatedAt: NOW,
};

describe('CommentService', () => {
  let service: CommentService;
  let prisma: {
    post: { findUnique: jest.Mock };
    comment: { create: jest.Mock; findMany: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      post: { findUnique: jest.fn() },
      comment: { create: jest.fn(), findMany: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [CommentService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<CommentService>(CommentService);
  });

  // ── create ──────────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('포스트가 존재하면 댓글을 생성하고 CommentResponse 를 반환', async () => {
      prisma.post.findUnique.mockResolvedValue(mockPost);
      prisma.comment.create.mockResolvedValue(mockComment);

      const result = await service.create(1, 10, {
        content: '테스트 댓글입니다.',
      });

      expect(result.id).toBe(100);
      expect(result.content).toBe('테스트 댓글입니다.');
      expect(result.postId).toBe(10);
      expect(result.author).toEqual(mockAuthor);
      expect(result.createdAt).toBe(NOW);
    });

    it('포스트가 존재하지 않으면 NotFoundException 발생', async () => {
      prisma.post.findUnique.mockResolvedValue(null);

      await expect(service.create(1, 999, { content: '댓글' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('prisma.comment.create 에 올바른 데이터 전달', async () => {
      prisma.post.findUnique.mockResolvedValue(mockPost);
      prisma.comment.create.mockResolvedValue(mockComment);

      await service.create(1, 10, { content: '테스트 댓글입니다.' });

      expect(prisma.comment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { content: '테스트 댓글입니다.', postId: 10, authorId: 1 },
        }),
      );
    });
  });

  // ── findByPostId ─────────────────────────────────────────────────────────────

  describe('findByPostId()', () => {
    it('포스트가 존재하면 댓글 목록 반환', async () => {
      prisma.post.findUnique.mockResolvedValue(mockPost);
      prisma.comment.findMany.mockResolvedValue([mockComment]);

      const result = await service.findByPostId(10);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(100);
      expect(result[0].author).toEqual(mockAuthor);
    });

    it('포스트가 존재하지 않으면 NotFoundException 발생', async () => {
      prisma.post.findUnique.mockResolvedValue(null);

      await expect(service.findByPostId(999)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('댓글이 없는 포스트는 빈 배열 반환', async () => {
      prisma.post.findUnique.mockResolvedValue(mockPost);
      prisma.comment.findMany.mockResolvedValue([]);

      const result = await service.findByPostId(10);

      expect(result).toEqual([]);
    });

    it('findMany 에 올바른 where/orderBy 전달', async () => {
      prisma.post.findUnique.mockResolvedValue(mockPost);
      prisma.comment.findMany.mockResolvedValue([]);

      await service.findByPostId(10);

      expect(prisma.comment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { postId: 10 },
          orderBy: { createdAt: 'asc' },
        }),
      );
    });
  });
});
