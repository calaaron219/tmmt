import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ROUTINES_QUEUE, RoutineJob } from './routines.constants';

/**
 * Registers the daily routine-generation schedule on boot. Uses a cron
 * `pattern` (not `every`), so — unlike PR #1's heartbeat — it does NOT fire on
 * boot; it waits for the next 00:05 UTC. `upsertJobScheduler` is idempotent on
 * the scheduler id, so redeploys update the one schedule instead of stacking.
 */
@Injectable()
export class RoutinesScheduler implements OnApplicationBootstrap {
  private readonly logger = new Logger(RoutinesScheduler.name);

  constructor(@InjectQueue(ROUTINES_QUEUE) private readonly queue: Queue) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.queue.upsertJobScheduler(
      'routines-daily',
      { pattern: '5 0 * * *', tz: 'UTC' },
      {
        name: RoutineJob.GenerateDaily,
        opts: { removeOnComplete: true, removeOnFail: 50 },
      },
    );
    this.logger.log('routine generation scheduled: daily at 00:05 UTC');
  }
}
