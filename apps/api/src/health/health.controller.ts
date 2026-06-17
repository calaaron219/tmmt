import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { SYSTEM_QUEUE } from '../queue/system.constants';

/**
 * GET /healthz — at-a-glance "can the worker reach its backbone".
 *
 * `getJobCounts()` is itself a Redis round-trip, so a successful return means
 * Redis is reachable; we surface the counts as a bonus. Returns 503 if it
 * throws, so an uptime probe can tell "process up but Redis down" from healthy.
 */
@Controller('healthz')
export class HealthController {
  constructor(@InjectQueue(SYSTEM_QUEUE) private readonly queue: Queue) {}

  @Get()
  async check(): Promise<{
    status: 'ok';
    redis: 'up';
    queue: Record<string, number>;
  }> {
    try {
      const queue = await this.queue.getJobCounts();
      return { status: 'ok', redis: 'up', queue };
    } catch {
      throw new HttpException(
        { status: 'degraded', redis: 'down', queue: null },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}
