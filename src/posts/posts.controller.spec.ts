import { Test, TestingModule } from '@nestjs/testing';
import { PublishStatus } from '../shared/types/publish-status.types';
import { PostsController } from './posts.controller';
import { PostResponse, PostsService } from './posts.service';

// ── 모킹 ─────────────────────────────────────────────────────────────────────

const mockAuthor = { id: 10, email: 'author@example.com', role: 'user' };

const mockPostResponse: PostResponse = {
  id: 1,
  title: '테스트 포스트',
  slug: 'test-post',
  content: '내용',
  status: PublishStatus.DRAFT,
  author: mockAuthor,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const mockPostsService = {
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
  findPublishedBySlug: jest.fn(),
  findAll: jest.fn(),
};

const mockJwtUser = { sub: 10, email: 'author@example.com', role: 'user' };

// ── 테스트 ────────────────────────────────────────────────────────────────────

describe('PostsController', () => {
  let controller: PostsController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PostsController],
      providers: [{ provide: PostsService, useValue: mockPostsService }],
    }).compile();

    controller = module.get<PostsController>(PostsController);
  });

  describe('create()', () => {
    it('service.create 호출 후 PostResponse 반환', async () => {
      mockPostsService.create.mockResolvedValueOnce(mockPostResponse);

      const result = await controller.create(
        { user: mockJwtUser },
        { title: '테스트 포스트' },
      );

      expect(mockPostsService.create).toHaveBeenCalledWith(10, {
        title: '테스트 포스트',
      });
      expect(result).toEqual(mockPostResponse);
    });
  });

  describe('update()', () => {
    it('service.update 호출 후 PostResponse 반환', async () => {
      const updated = { ...mockPostResponse, title: '수정된 제목' };
      mockPostsService.update.mockResolvedValueOnce(updated);

      const result = await controller.update(
        1,
        { user: mockJwtUser },
        {
          title: '수정된 제목',
        },
      );

      expect(mockPostsService.update).toHaveBeenCalledWith(1, 10, {
        title: '수정된 제목',
      });
      expect(result.title).toBe('수정된 제목');
    });
  });

  describe('remove()', () => {
    it('service.remove 호출 — void 반환', async () => {
      mockPostsService.remove.mockResolvedValueOnce(undefined);

      await expect(
        controller.remove(1, { user: mockJwtUser }),
      ).resolves.toBeUndefined();
      expect(mockPostsService.remove).toHaveBeenCalledWith(1, 10);
    });
  });

  describe('findAll()', () => {
    it('기본값(page=1, pageSize=10)으로 service.findAll 호출', async () => {
      const paginatedResult = {
        data: [mockPostResponse],
        total: 1,
        page: 1,
        pageSize: 10,
        totalPages: 1,
      };
      mockPostsService.findAll.mockResolvedValueOnce(paginatedResult);

      const result = await controller.findAll();

      expect(mockPostsService.findAll).toHaveBeenCalledWith(1, 10);
      expect(result.data).toHaveLength(1);
    });

    it('쿼리 파라미터 파싱 후 service.findAll 호출', async () => {
      mockPostsService.findAll.mockResolvedValueOnce({
        data: [],
        total: 0,
        page: 2,
        pageSize: 5,
        totalPages: 0,
      });

      await controller.findAll('2', '5');

      expect(mockPostsService.findAll).toHaveBeenCalledWith(2, 5);
    });

    it('잘못된 page 값은 1로 대체', async () => {
      mockPostsService.findAll.mockResolvedValueOnce({
        data: [],
        total: 0,
        page: 1,
        pageSize: 10,
        totalPages: 0,
      });

      await controller.findAll('invalid');

      expect(mockPostsService.findAll).toHaveBeenCalledWith(1, 10);
    });

    it('page=0 이면 1로 대체', async () => {
      mockPostsService.findAll.mockResolvedValueOnce({
        data: [],
        total: 0,
        page: 1,
        pageSize: 10,
        totalPages: 0,
      });

      await controller.findAll('0');

      expect(mockPostsService.findAll).toHaveBeenCalledWith(1, 10);
    });
  });

  describe('findBySlug()', () => {
    it('service.findPublishedBySlug 호출 후 PostResponse 반환', async () => {
      const publishedPost = {
        ...mockPostResponse,
        status: PublishStatus.PUBLISHED,
      };
      mockPostsService.findPublishedBySlug.mockResolvedValueOnce(publishedPost);

      const result = await controller.findBySlug('test-post');

      expect(mockPostsService.findPublishedBySlug).toHaveBeenCalledWith(
        'test-post',
      );
      expect(result.status).toBe(PublishStatus.PUBLISHED);
    });
  });
});
