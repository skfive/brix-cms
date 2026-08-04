import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('GET /', () => {
    it('should keep status "ok"', () => {
      expect(appController.getHealth().status).toBe('ok');
    });

    it('should return object with status string property', () => {
      const result = appController.getHealth();
      expect(result).toHaveProperty('status');
      expect(typeof result.status).toBe('string');
    });

    it('should return a non-negative integer uptimeSec', () => {
      const result = appController.getHealth();
      expect(typeof result.uptimeSec).toBe('number');
      expect(Number.isInteger(result.uptimeSec)).toBe(true);
      expect(result.uptimeSec).toBeGreaterThanOrEqual(0);
    });

    it('should return a non-empty version string', () => {
      const result = appController.getHealth();
      expect(typeof result.version).toBe('string');
      expect(result.version.length).toBeGreaterThan(0);
    });
  });
});
