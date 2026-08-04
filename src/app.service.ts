import { Injectable } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';

export interface HealthResponse {
  readonly status: string;
  readonly uptimeSec: number;
  readonly version: string;
}

@Injectable()
export class AppService {
  private readonly version: string = AppService.readVersion();

  getHealth(): HealthResponse {
    return {
      status: 'ok',
      uptimeSec: Math.floor(process.uptime()),
      version: this.version,
    };
  }

  private static readVersion(): string {
    const pkgPath = join(process.cwd(), 'package.json');
    const parsed = JSON.parse(readFileSync(pkgPath, 'utf8')) as {
      version?: string;
    };
    return parsed.version ?? '';
  }
}
