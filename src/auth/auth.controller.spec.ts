import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

const mockAuthService = {
  register: jest.fn(),
  login: jest.fn(),
};

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  describe('POST /auth/register', () => {
    it('register 호출 시 AuthService.register 위임 후 결과 반환', async () => {
      const expected = { id: 1, email: 'test@example.com', role: 'user' };
      mockAuthService.register.mockResolvedValue(expected);

      const result = await controller.register({
        email: 'test@example.com',
        password: 'pw123',
      });

      expect(mockAuthService.register).toHaveBeenCalledWith(
        'test@example.com',
        'pw123',
      );
      expect(result).toEqual(expected);
    });
  });

  describe('POST /auth/login', () => {
    it('login 호출 시 AuthService.login 위임 후 JWT 반환', async () => {
      const expected = { access_token: 'jwt-token-here' };
      mockAuthService.login.mockResolvedValue(expected);

      const result = await controller.login({
        email: 'test@example.com',
        password: 'pw123',
      });

      expect(mockAuthService.login).toHaveBeenCalledWith(
        'test@example.com',
        'pw123',
      );
      expect(result).toEqual(expected);
    });
  });
});
