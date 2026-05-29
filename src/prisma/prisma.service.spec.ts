import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  let prismaService: PrismaService;

  beforeEach(() => {
    prismaService = new PrismaService();
    jest.spyOn(prismaService, '$connect').mockResolvedValue(undefined);
    jest.spyOn(prismaService, '$disconnect').mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(prismaService).toBeDefined();
  });

  it('onModuleInit should call $connect', async () => {
    await prismaService.onModuleInit();
    expect(prismaService.$connect).toHaveBeenCalledTimes(1);
  });

  it('onModuleDestroy should call $disconnect', async () => {
    await prismaService.onModuleDestroy();
    expect(prismaService.$disconnect).toHaveBeenCalledTimes(1);
  });
});
