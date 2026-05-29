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
    it('should return { status: "ok" }', () => {
      expect(appController.getHealth()).toEqual({ status: 'ok' });
    });

    it('should return object with status string property', () => {
      const result = appController.getHealth();
      expect(result).toHaveProperty('status');
      expect(typeof result.status).toBe('string');
    });
  });
});
