import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { buildCorsOptions } from './config/cors.config';
import helmet from 'helmet';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);

  // Security: Helmet sets various HTTP security headers
  app.use(helmet());

  // CORS: 화이트리스트 기반 cross-origin 허용 (BF-727)
  // CORS_ALLOWED_ORIGINS 환경변수(comma-separated)로 origin 동적 지정,
  // 미지정 시 dev 기본값(localhost:3000, localhost:3001) 사용.
  const corsAllowedOrigins = configService.get<string>('CORS_ALLOWED_ORIGINS');
  app.enableCors(buildCorsOptions(corsAllowedOrigins));

  await app.listen(port);
}

bootstrap().catch((err: unknown) => {
  console.error('Failed to start application:', err);
  process.exit(1);
});
