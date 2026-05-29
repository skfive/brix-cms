import { Test, TestingModule } from '@nestjs/testing';
import { PublishStatus } from '../shared/types/publish-status.types';
import { PageController } from './page.controller';
import { PageResponse, PageService } from './page.service';

// ── 모킹 ─────────────────────────────────────────────────────────────────────

const mockAuthor = { id: 10, email: 'author@example.com', role: 'user' };

const mockPageResponse: PageResponse = {
  id: 1,
  title: '테스트 페이지',
  slug: 'test-page',
  content: '페이지 내용',
  status: PublishStatus.DRAFT,
  author: mockAuthor,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const mockPageService = {
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
  findBySlug: jest.fn(),
};

const mockJwtUser = { sub: 10, email: 'author@example.com', role: 'user' };

// ── 테스트 ────────────────────────────────────────────────────────────────────

describe('PageController', () => {
  let controller: PageController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PageController],
      providers: [{ provide: PageService, useValue: mockPageService }],
    }).compile();

    controller = module.get<PageController>(PageController);
  });

  describe('create()', () => {
    it('service.create 호출 후 PageResponse 반환', async () => {
      mockPageService.create.mockResolvedValueOnce(mockPageResponse);

      const result = await controller.create(
        { user: mockJwtUser },
        { title: '테스트 페이지' },
      );

      expect(mockPageService.create).toHaveBeenCalledWith(10, {
        title: '테스트 페이지',
      });
      expect(result).toEqual(mockPageResponse);
    });

    it('req.user.sub 를 authorId 로 전달', async () => {
      mockPageService.create.mockResolvedValueOnce(mockPageResponse);

      await controller.create(
        { user: { sub: 42, email: 'other@example.com', role: 'user' } },
        { title: '페이지' },
      );

      expect(mockPageService.create).toHaveBeenCalledWith(
        42,
        expect.any(Object),
      );
    });
  });

  describe('update()', () => {
    it('service.update 호출 후 PageResponse 반환', async () => {
      const updated = { ...mockPageResponse, title: '수정된 제목' };
      mockPageService.update.mockResolvedValueOnce(updated);

      const result = await controller.update(
        1,
        { user: mockJwtUser },
        { title: '수정된 제목' },
      );

      expect(mockPageService.update).toHaveBeenCalledWith(1, 10, {
        title: '수정된 제목',
      });
      expect(result.title).toBe('수정된 제목');
    });
  });

  describe('remove()', () => {
    it('service.remove 호출 — void 반환', async () => {
      mockPageService.remove.mockResolvedValueOnce(undefined);

      await expect(
        controller.remove(1, { user: mockJwtUser }),
      ).resolves.toBeUndefined();
      expect(mockPageService.remove).toHaveBeenCalledWith(1, 10);
    });
  });

  describe('findBySlug()', () => {
    it('service.findBySlug 호출 후 PageResponse 반환', async () => {
      const publishedPage = {
        ...mockPageResponse,
        status: PublishStatus.PUBLISHED,
      };
      mockPageService.findBySlug.mockResolvedValueOnce(publishedPage);

      const result = await controller.findBySlug('test-page');

      expect(mockPageService.findBySlug).toHaveBeenCalledWith('test-page');
      expect(result.slug).toBe('test-page');
    });

    it('인증 없이도 slug 조회 — 서비스 위임 확인', async () => {
      mockPageService.findBySlug.mockResolvedValueOnce(mockPageResponse);

      const result = await controller.findBySlug('about-us');

      expect(mockPageService.findBySlug).toHaveBeenCalledWith('about-us');
      expect(result).toBeDefined();
    });
  });
});
