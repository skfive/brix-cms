import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { PublishStatus } from '../shared/types/publish-status.types';
import { CreatePageDto } from './dto/create-page.dto';
import { UpdatePageDto } from './dto/update-page.dto';
import { PageService } from './page.service';

// ── Prisma 모킹 ───────────────────────────────────────────────────────────────

const mockPage = {
  id: 1,
  title: '테스트 페이지',
  slug: 'test-page',
  content: '페이지 내용',
  status: PublishStatus.DRAFT,
  authorId: 10,
  author: { id: 10, email: 'author@example.com', role: 'user' },
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const mockPublishedPage = { ...mockPage, status: PublishStatus.PUBLISHED };

const prismaMock = {
  page: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

// ── 테스트 모듈 ───────────────────────────────────────────────────────────────

describe('PageService', () => {
  let service: PageService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PageService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<PageService>(PageService);
  });

  // ── create ─────────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('slug 미지정 시 title 에서 자동 생성하여 페이지 반환', async () => {
      prismaMock.page.findUnique.mockResolvedValueOnce(null);
      prismaMock.page.create.mockResolvedValueOnce(mockPage);

      const dto: CreatePageDto = { title: '테스트 페이지' };
      const result = await service.create(10, dto);

      expect(prismaMock.page.findUnique).toHaveBeenCalledWith({
        where: { slug: '테스트-페이지' },
      });
      expect(result.title).toBe('테스트 페이지');
      expect(result.author.email).toBe('author@example.com');
    });

    it('slug 명시 시 해당 slug 사용', async () => {
      prismaMock.page.findUnique.mockResolvedValueOnce(null);
      prismaMock.page.create.mockResolvedValueOnce({
        ...mockPage,
        slug: 'custom-slug',
      });

      const dto: CreatePageDto = { title: '페이지', slug: 'custom-slug' };
      await service.create(10, dto);

      expect(prismaMock.page.findUnique).toHaveBeenCalledWith({
        where: { slug: 'custom-slug' },
      });
    });

    it('slug 중복 시 ConflictException throw', async () => {
      prismaMock.page.findUnique.mockResolvedValueOnce(mockPage);

      await expect(
        service.create(10, { title: '중복 페이지', slug: 'test-page' }),
      ).rejects.toThrow(ConflictException);
    });

    it('status 미지정 시 DRAFT 로 생성', async () => {
      prismaMock.page.findUnique.mockResolvedValueOnce(null);
      prismaMock.page.create.mockResolvedValueOnce(mockPage);

      await service.create(10, { title: '페이지' });

      expect(prismaMock.page.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: PublishStatus.DRAFT }),
        }),
      );
    });

    it('status 지정 시 해당 status 로 생성', async () => {
      prismaMock.page.findUnique.mockResolvedValueOnce(null);
      prismaMock.page.create.mockResolvedValueOnce(mockPublishedPage);

      await service.create(10, {
        title: '발행 페이지',
        status: PublishStatus.PUBLISHED,
      });

      expect(prismaMock.page.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: PublishStatus.PUBLISHED }),
        }),
      );
    });

    it('content 미지정 시 null 로 저장', async () => {
      prismaMock.page.findUnique.mockResolvedValueOnce(null);
      prismaMock.page.create.mockResolvedValueOnce({
        ...mockPage,
        content: null,
      });

      await service.create(10, { title: '내용없는 페이지' });

      expect(prismaMock.page.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ content: null }),
        }),
      );
    });
  });

  // ── update ─────────────────────────────────────────────────────────────────

  describe('update()', () => {
    it('정상 수정 — 페이지 반환', async () => {
      prismaMock.page.findUnique.mockResolvedValueOnce(mockPage);
      prismaMock.page.update.mockResolvedValueOnce({
        ...mockPage,
        title: '수정된 제목',
      });

      const dto: UpdatePageDto = { title: '수정된 제목' };
      const result = await service.update(1, 10, dto);

      expect(result.title).toBe('수정된 제목');
    });

    it('페이지 없으면 NotFoundException', async () => {
      prismaMock.page.findUnique.mockResolvedValueOnce(null);

      await expect(service.update(999, 10, {})).rejects.toThrow(
        NotFoundException,
      );
    });

    it('본인 외 수정 시 ForbiddenException', async () => {
      prismaMock.page.findUnique.mockResolvedValueOnce(mockPage); // authorId=10

      await expect(service.update(1, 99, {})).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('slug 변경 시 중복 검사 수행', async () => {
      prismaMock.page.findUnique
        .mockResolvedValueOnce(mockPage) // 페이지 조회
        .mockResolvedValueOnce(null); // slug 중복 없음
      prismaMock.page.update.mockResolvedValueOnce({
        ...mockPage,
        slug: 'new-slug',
      });

      await service.update(1, 10, { slug: 'new-slug' });

      expect(prismaMock.page.findUnique).toHaveBeenNthCalledWith(2, {
        where: { slug: 'new-slug' },
      });
    });

    it('slug 변경 시 중복이면 ConflictException', async () => {
      prismaMock.page.findUnique
        .mockResolvedValueOnce(mockPage) // 페이지 조회
        .mockResolvedValueOnce({ ...mockPage, id: 2, slug: 'dup-slug' }); // slug 이미 존재

      await expect(service.update(1, 10, { slug: 'dup-slug' })).rejects.toThrow(
        ConflictException,
      );
    });

    it('slug 미변경 시 중복 검사 skip', async () => {
      prismaMock.page.findUnique.mockResolvedValueOnce(mockPage);
      prismaMock.page.update.mockResolvedValueOnce(mockPage);

      await service.update(1, 10, { title: '제목만 변경' });

      // findUnique 는 페이지 조회 1번만 호출 (slug 중복 검사 없음)
      expect(prismaMock.page.findUnique).toHaveBeenCalledTimes(1);
    });

    it('content 수정 정상 반영', async () => {
      prismaMock.page.findUnique.mockResolvedValueOnce(mockPage);
      prismaMock.page.update.mockResolvedValueOnce({
        ...mockPage,
        content: '수정된 내용',
      });

      const result = await service.update(1, 10, { content: '수정된 내용' });

      expect(result.content).toBe('수정된 내용');
    });
  });

  // ── remove ─────────────────────────────────────────────────────────────────

  describe('remove()', () => {
    it('정상 삭제 — void 반환', async () => {
      prismaMock.page.findUnique.mockResolvedValueOnce(mockPage);
      prismaMock.page.delete.mockResolvedValueOnce(mockPage);

      await expect(service.remove(1, 10)).resolves.toBeUndefined();
      expect(prismaMock.page.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('페이지 없으면 NotFoundException', async () => {
      prismaMock.page.findUnique.mockResolvedValueOnce(null);

      await expect(service.remove(999, 10)).rejects.toThrow(NotFoundException);
    });

    it('본인 외 삭제 시 ForbiddenException', async () => {
      prismaMock.page.findUnique.mockResolvedValueOnce(mockPage); // authorId=10

      await expect(service.remove(1, 99)).rejects.toThrow(ForbiddenException);
    });
  });

  // ── findBySlug ────────────────────────────────────────────────────────────

  describe('findBySlug()', () => {
    it('슬러그로 페이지 조회 성공', async () => {
      prismaMock.page.findUnique.mockResolvedValueOnce(mockPage);

      const result = await service.findBySlug('test-page');

      expect(result.slug).toBe('test-page');
      expect(result.title).toBe('테스트 페이지');
      expect(prismaMock.page.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { slug: 'test-page' },
        }),
      );
    });

    it('존재하지 않는 slug 는 NotFoundException', async () => {
      prismaMock.page.findUnique.mockResolvedValueOnce(null);

      await expect(service.findBySlug('no-such-page')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('DRAFT 상태 페이지도 슬러그로 조회 가능', async () => {
      prismaMock.page.findUnique.mockResolvedValueOnce(mockPage); // status=DRAFT

      const result = await service.findBySlug('test-page');

      expect(result.status).toBe(PublishStatus.DRAFT);
    });

    it('응답에 author 정보 포함', async () => {
      prismaMock.page.findUnique.mockResolvedValueOnce(mockPage);

      const result = await service.findBySlug('test-page');

      expect(result.author).toBeDefined();
      expect(result.author.email).toBe('author@example.com');
    });
  });
});
