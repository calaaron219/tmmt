import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * The worker's Prisma client. We instantiate `@prisma/client` directly (real
 * generated JS) rather than importing `@tmmt/db`'s singleton, whose entrypoint
 * is raw `.ts` that `node dist` can't require. The generated client is shared
 * via the workspace store (produced by `@tmmt/db`'s postinstall) and reads
 * `DATABASE_URL` from the environment, same as the web app.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
