import { Test, TestingModule } from '@nestjs/testing';
import { AppService } from './app.service';

describe('AppService', () => {
  let appService: AppService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AppService],
    }).compile();

    appService = module.get<AppService>(AppService);
  });

  describe('getHealth', () => {
    it('should return { status: "ok" }', () => {
      expect(appService.getHealth()).toEqual({ status: 'ok' });
    });

    it('should return object with status string property', () => {
      const result = appService.getHealth();
      expect(typeof result).toBe('object');
      expect(result.status).toBe('ok');
    });
  });
});
