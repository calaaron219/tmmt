import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import type { ConnectionOptions } from 'bullmq';
import { SYSTEM_QUEUE } from './system.constants';
import { SystemProcessor } from './system.processor';
import { SystemBootstrap } from './system.bootstrap';

/**
 * Builds the Redis connection BullMQ uses from REDIS_URL.
 *
 * We pass a plain options object (not a pre-built ioredis instance) so BullMQ
 * owns its connections and can duplicate them for blocking worker reads.
 *
 * `family: 0` is the important bit for production: Railway's private network
 * resolves over IPv6, but ioredis defaults to IPv4-only DNS. 0 = allow both
 * A and AAAA records, so the same config works on Railway and on localhost.
 */
function buildRedisConnection(): ConnectionOptions {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error('REDIS_URL is not set — the worker needs Redis to run.');
  }

  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 6379,
    username: decodeURIComponent(parsed.username) || undefined,
    password: decodeURIComponent(parsed.password) || undefined,
    family: 0,
    ...(parsed.protocol === 'rediss:' ? { tls: {} } : {}),
  };
}

/**
 * Owns everything Redis/BullMQ. `forRoot` registers the shared connection;
 * `registerQueue` creates the injectable `system` queue handle. Re-exporting
 * BullModule lets other modules (e.g. the health check) inject that queue.
 */
@Module({
  imports: [
    BullModule.forRoot({ connection: buildRedisConnection() }),
    BullModule.registerQueue({ name: SYSTEM_QUEUE }),
  ],
  providers: [SystemProcessor, SystemBootstrap],
  exports: [BullModule],
})
export class QueueModule {}
