import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

const mockPrismaService = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
};

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  describe('create', () => {
    it('신규 이메일로 가입하면 bcrypt 해시 저장 후 User 반환', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      const fakeUser = {
        id: 1,
        email: 'test@example.com',
        password_hash: 'hashed',
        role: 'user',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrismaService.user.create.mockResolvedValue(fakeUser);

      const result = await service.create('test@example.com', 'password123');

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
      expect(mockPrismaService.user.create).toHaveBeenCalledOnce();
      const createCall = mockPrismaService.user.create.mock.calls[0][0] as {
        data: { email: string; password_hash: string };
      };
      // bcrypt 해시가 원본 평문과 다른지 확인
      expect(createCall.data.password_hash).not.toBe('password123');
      // bcrypt.compare 로 검증 가능한지 확인
      const isValid = await bcrypt.compare(
        'password123',
        createCall.data.password_hash,
      );
      expect(isValid).toBe(true);
      expect(result).toEqual(fakeUser);
    });

    it('이미 가입된 이메일이면 ConflictException 발생', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 1,
        email: 'exist@example.com',
      });

      await expect(
        service.create('exist@example.com', 'password123'),
      ).rejects.toThrow(ConflictException);

      expect(mockPrismaService.user.create).not.toHaveBeenCalled();
    });
  });

  describe('findByEmail', () => {
    it('존재하는 이메일이면 User 반환', async () => {
      const fakeUser = { id: 1, email: 'find@example.com' };
      mockPrismaService.user.findUnique.mockResolvedValue(fakeUser);

      const result = await service.findByEmail('find@example.com');

      expect(result).toEqual(fakeUser);
    });

    it('존재하지 않는 이메일이면 null 반환', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.findByEmail('notfound@example.com');

      expect(result).toBeNull();
    });
  });
});

// jest matcher 확장 헬퍼 (jest 기본 포함)
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      toHaveBeenCalledOnce(): R;
    }
  }
}
expect.extend({
  toHaveBeenCalledOnce(received: jest.Mock) {
    const pass = received.mock.calls.length === 1;
    return {
      pass,
      message: () =>
        pass
          ? `예상치 않게 1회 호출됨`
          : `1회 호출 기대, 실제: ${received.mock.calls.length}회`,
    };
  },
});
