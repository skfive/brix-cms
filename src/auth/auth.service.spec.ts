import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

const mockUsersService = {
  create: jest.fn(),
  findByEmail: jest.fn(),
};

const mockJwtService = {
  sign: jest.fn(),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('register', () => {
    it('회원가입 성공 시 id, email, role 반환 (password_hash 미노출)', async () => {
      mockUsersService.create.mockResolvedValue({
        id: 1,
        email: 'new@example.com',
        password_hash: 'hashed-pw',
        role: 'user',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.register('new@example.com', 'pw123');

      expect(result).toEqual({ id: 1, email: 'new@example.com', role: 'user' });
      expect(result).not.toHaveProperty('password_hash');
    });

    it('UsersService.create 가 throw 하면 그대로 전파', async () => {
      mockUsersService.create.mockRejectedValue(new Error('DB 오류'));

      await expect(service.register('err@example.com', 'pw')).rejects.toThrow(
        'DB 오류',
      );
    });
  });

  describe('login', () => {
    it('올바른 자격증명으로 로그인하면 유효 JWT 반환', async () => {
      const password = 'correctPw!';
      const hash = await bcrypt.hash(password, 10);
      mockUsersService.findByEmail.mockResolvedValue({
        id: 2,
        email: 'user@example.com',
        password_hash: hash,
        role: 'user',
      });
      mockJwtService.sign.mockReturnValue('signed-jwt-token');

      const result = await service.login('user@example.com', password);

      expect(mockJwtService.sign).toHaveBeenCalledWith({
        sub: 2,
        email: 'user@example.com',
        role: 'user',
      });
      expect(result).toEqual({ access_token: 'signed-jwt-token' });
    });

    it('존재하지 않는 이메일로 로그인하면 UnauthorizedException', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);

      await expect(service.login('ghost@example.com', 'pw')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('잘못된 비밀번호로 로그인하면 UnauthorizedException', async () => {
      const hash = await bcrypt.hash('correctPw', 10);
      mockUsersService.findByEmail.mockResolvedValue({
        id: 3,
        email: 'user2@example.com',
        password_hash: hash,
        role: 'user',
      });

      await expect(
        service.login('user2@example.com', 'wrongPw'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
