import { Global, Injectable, Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    // Query logging is off: queries can contain personal data.
    super({ log: ['warn', 'error'] });
  }
  async onModuleInit() {
    await this.$connect();
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }

  /** Financial mutations run SERIALIZABLE and are retried on serialization conflicts. */
  async serializable<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>, retries = 3): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.$transaction(fn, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000 });
      } catch (e) {
        const code = (e as { code?: string }).code;
        if (attempt < retries && (code === 'P2034' || /could not serialize/i.test(String((e as Error).message)))) continue;
        throw e;
      }
    }
  }
}

export type Tx = Prisma.TransactionClient;

@Global()
@Module({ providers: [PrismaService], exports: [PrismaService] })
export class PrismaModule {}
