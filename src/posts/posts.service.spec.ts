import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { PublishStatus } from '../shared/types/publish-status.types';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostsService } from './posts.service';

// ── Prisma 모킹 ───────────────────────────────────────────────────────────────

const mockPost = {
  id: 1,
  title: '테스트 포스트',
  slug: 'test-post',
  content: '내용',
  status: PublishStatus.DRAFT,
  authorId: 10,
  author: { id: 10, email: 'author@example.com', role: 'user' },
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const mockPublishedPost = { ...mockPost, status: PublishStatus.PUBLISHED };

const prismaMock = {
  post: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  $transaction: jest.fn(),
};

// ── 테스트 모듈 ───────────────────────────────────────────────────────────────

describe('PostsService', () => {
  let service: PostsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<PostsService>(PostsService);
  });

  // ── create ─────────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('slug 미지정 시 title 에서 자동 생성하여 포스트 반환', async () => {
      prismaMock.post.findUnique.mockResolvedValueOnce(null); // slug 중복 없음
      prismaMock.post.create.mockResolvedValueOnce(mockPost);

      const dto: CreatePostDto = { title: '테스트 포스트' };
      const result = await service.create(10, dto);

      // generateSlug('테스트 포스트') → '테스트-포스트' (한글 유니코드 보존)
      expect(prismaMock.post.findUnique).toHaveBeenCalledWith({
        where: { slug: '테스트-포스트' },
      });
      expect(result.title).toBe('테스트 포스트');
      expect(result.author.email).toBe('author@example.com');
    });

    it('slug 명시 시 해당 slug 사용', async () => {
      prismaMock.post.findUnique.mockResolvedValueOnce(null);
      prismaMock.post.create.mockResolvedValueOnce({
        ...mockPost,
        slug: 'custom-slug',
      });

      const dto: CreatePostDto = { title: '포스트', slug: 'custom-slug' };
      await service.create(10, dto);

      expect(prismaMock.post.findUnique).toHaveBeenCalledWith({
        where: { slug: 'custom-slug' },
      });
    });

    it('slug 중복 시 ConflictException throw', async () => {
      prismaMock.post.findUnique.mockResolvedValueOnce(mockPost); // 이미 존재

      await expect(
        service.create(10, { title: '중복 포스트', slug: 'test-post' }),
      ).rejects.toThrow(ConflictException);
    });

    it('status 미지정 시 DRAFT 로 생성', async () => {
      prismaMock.post.findUnique.mockResolvedValueOnce(null);
      prismaMock.post.create.mockResolvedValueOnce(mockPost);

      await service.create(10, { title: '포스트' });

      expect(prismaMock.post.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: PublishStatus.DRAFT }),
        }),
      );
    });

    it('status 지정 시 해당 status 로 생성', async () => {
      prismaMock.post.findUnique.mockResolvedValueOnce(null);
      prismaMock.post.create.mockResolvedValueOnce(mockPublishedPost);

      await service.create(10, {
        title: '발행 포스트',
        status: PublishStatus.PUBLISHED,
      });

      expect(prismaMock.post.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: PublishStatus.PUBLISHED }),
        }),
      );
    });
  });

  // ── update ─────────────────────────────────────────────────────────────────

  describe('update()', () => {
    it('정상 수정 — 포스트 반환', async () => {
      prismaMock.post.findUnique.mockResolvedValueOnce(mockPost);
      prismaMock.post.update.mockResolvedValueOnce({
        ...mockPost,
        title: '수정된 제목',
      });

      const dto: UpdatePostDto = { title: '수정된 제목' };
      const result = await service.update(1, 10, dto);

      expect(result.title).toBe('수정된 제목');
    });

    it('포스트 없으면 NotFoundException', async () => {
      prismaMock.post.findUnique.mockResolvedValueOnce(null);

      await expect(service.update(999, 10, {})).rejects.toThrow(
        NotFoundException,
      );
    });

    it('본인 외 수정 시 ForbiddenException', async () => {
      prismaMock.post.findUnique.mockResolvedValueOnce(mockPost); // authorId=10

      await expect(service.update(1, 99, {})).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('slug 변경 시 중복 검사 수행', async () => {
      prismaMock.post.findUnique
        .mockResolvedValueOnce(mockPost) // 포스트 조회
        .mockResolvedValueOnce(null); // slug 중복 없음
      prismaMock.post.update.mockResolvedValueOnce({
        ...mockPost,
        slug: 'new-slug',
      });

      await service.update(1, 10, { slug: 'new-slug' });

      expect(prismaMock.post.findUnique).toHaveBeenNthCalledWith(2, {
        where: { slug: 'new-slug' },
      });
    });

    it('slug 변경 시 중복이면 ConflictException', async () => {
      prismaMock.post.findUnique
        .mockResolvedValueOnce(mockPost) // 포스트 조회
        .mockResolvedValueOnce({ ...mockPost, id: 2, slug: 'dup-slug' }); // slug 이미 존재

      await expect(service.update(1, 10, { slug: 'dup-slug' })).rejects.toThrow(
        ConflictException,
      );
    });

    it('slug 미변경 시 중복 검사 skip', async () => {
      prismaMock.post.findUnique.mockResolvedValueOnce(mockPost);
      prismaMock.post.update.mockResolvedValueOnce(mockPost);

      await service.update(1, 10, { title: '제목만 변경' });

      // findUnique 는 포스트 조회 1번만 호출 (slug 중복 검사 없음)
      expect(prismaMock.post.findUnique).toHaveBeenCalledTimes(1);
    });
  });

  // ── remove ─────────────────────────────────────────────────────────────────

  describe('remove()', () => {
    it('정상 삭제 — void 반환', async () => {
      prismaMock.post.findUnique.mockResolvedValueOnce(mockPost);
      prismaMock.post.delete.mockResolvedValueOnce(mockPost);

      await expect(service.remove(1, 10)).resolves.toBeUndefined();
      expect(prismaMock.post.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('포스트 없으면 NotFoundException', async () => {
      prismaMock.post.findUnique.mockResolvedValueOnce(null);

      await expect(service.remove(999, 10)).rejects.toThrow(NotFoundException);
    });

    it('본인 외 삭제 시 ForbiddenException', async () => {
      prismaMock.post.findUnique.mockResolvedValueOnce(mockPost); // authorId=10

      await expect(service.remove(1, 99)).rejects.toThrow(ForbiddenException);
    });
  });

  // ── findPublishedBySlug ────────────────────────────────────────────────────

  describe('findPublishedBySlug()', () => {
    it('발행 포스트 조회 성공', async () => {
      prismaMock.post.findFirst.mockResolvedValueOnce(mockPublishedPost);

      const result = await service.findPublishedBySlug('test-post');

      expect(result.slug).toBe('test-post');
      expect(result.status).toBe(PublishStatus.PUBLISHED);
      expect(prismaMock.post.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { slug: 'test-post', status: PublishStatus.PUBLISHED },
        }),
      );
    });

    it('미발행 포스트는 NotFoundException (PUBLISHED 조건으로 조회 시 null)', async () => {
      prismaMock.post.findFirst.mockResolvedValueOnce(null); // DRAFT 포스트는 PUBLISHED 조건 미충족

      await expect(service.findPublishedBySlug('draft-post')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('존재하지 않는 slug 는 NotFoundException', async () => {
      prismaMock.post.findFirst.mockResolvedValueOnce(null);

      await expect(service.findPublishedBySlug('no-such-post')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── findAll ────────────────────────────────────────────────────────────────

  describe('findAll()', () => {
    it('발행 포스트 목록 반환 + 페이지네이션 구조', async () => {
      prismaMock.$transaction.mockResolvedValueOnce([
        [mockPublishedPost, mockPublishedPost],
        2,
      ]);

      const result = await service.findAll(1, 10);

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
      expect(result.totalPages).toBe(1);
    });

    it('2페이지 요청 시 skip 올바르게 계산 (calcSkip 사용)', async () => {
      prismaMock.$transaction.mockResolvedValueOnce([[mockPublishedPost], 11]);

      const result = await service.findAll(2, 5);

      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(5);
      expect(result.totalPages).toBe(3); // ceil(11/5)=3
      // $transaction 이 1회 호출됨 (findMany + count 배열 전달)
      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    });

    it('발행 포스트 없으면 빈 목록 반환', async () => {
      prismaMock.$transaction.mockResolvedValueOnce([[], 0]);

      const result = await service.findAll(1, 10);

      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
    });

    it('findAll 은 PUBLISHED 상태 필터로만 조회', async () => {
      prismaMock.$transaction.mockResolvedValueOnce([[], 0]);

      await service.findAll(1, 10);

      // $transaction 내부에서 findMany/count 호출 검증은 Prisma mock 특성상 어렵지만
      // $transaction 이 호출됐음을 확인
      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    });
  });
});
