import { JwtStrategy } from './jwt.strategy';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

function createStrategy(secret = 'test-secret'): JwtStrategy {
  const configService = {
    get: jest.fn().mockReturnValue(secret),
  } as unknown as ConfigService;
  return new JwtStrategy(configService);
}

describe('JwtStrategy', () => {
  it('JWT_SECRET 미설정 시 생성자에서 Error throw', () => {
    const configService = {
      get: jest.fn().mockReturnValue(undefined),
    } as unknown as ConfigService;

    expect(() => new JwtStrategy(configService)).toThrow(
      'JWT_SECRET 환경 변수가 설정되지 않았습니다.',
    );
  });

  describe('validate', () => {
    it('유효한 payload 반환 시 그대로 반환', () => {
      const strategy = createStrategy();
      const payload: JwtPayload = {
        sub: 1,
        email: 'user@example.com',
        role: 'user',
      };

      const result = strategy.validate(payload);

      expect(result).toEqual(payload);
    });

    it('sub 없는 payload 이면 UnauthorizedException', () => {
      const strategy = createStrategy();
      const badPayload = {
        email: 'x@x.com',
        role: 'user',
      } as unknown as JwtPayload;

      expect(() => strategy.validate(badPayload)).toThrow(
        UnauthorizedException,
      );
    });
  });
});
