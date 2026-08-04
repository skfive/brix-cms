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
    it('should keep status "ok"', () => {
      expect(appService.getHealth().status).toBe('ok');
    });

    it('should return object with status string property', () => {
      const result = appService.getHealth();
      expect(typeof result).toBe('object');
      expect(result.status).toBe('ok');
    });

    it('should return a non-negative integer uptimeSec', () => {
      const result = appService.getHealth();
      expect(typeof result.uptimeSec).toBe('number');
      expect(Number.isInteger(result.uptimeSec)).toBe(true);
      expect(result.uptimeSec).toBeGreaterThanOrEqual(0);
    });

    it('should return a non-empty version string', () => {
      const result = appService.getHealth();
      expect(typeof result.version).toBe('string');
      expect(result.version.length).toBeGreaterThan(0);
    });
  });
});
