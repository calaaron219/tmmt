import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { SYSTEM_QUEUE, SystemJob } from './system.constants';

/**
 * The producer side. Runs once after the app (and the worker) are ready:
 *
 *  1. Enqueues a single `ping` — a liveness proof that a job can travel
 *     producer → Redis → worker on this deploy.
 *  2. Upserts a repeatable `heartbeat`. `upsertJobScheduler` is idempotent on
 *     the scheduler id, so re-running this on every restart/redeploy updates
 *     the one schedule instead of stacking duplicates. PR #2 swaps this for
 *     the daily routine-generation schedule.
 */
@Injectable()
export class SystemBootstrap implements OnApplicationBootstrap {
  private readonly logger = new Logger(SystemBootstrap.name);

  constructor(@InjectQueue(SYSTEM_QUEUE) private readonly queue: Queue) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.queue.add(
      SystemJob.Ping,
      { at: 'boot' },
      { removeOnComplete: true, removeOnFail: 100 },
    );

    await this.queue.upsertJobScheduler(
      'system-heartbeat',
      { every: 15 * 60 * 1000 },
      { name: SystemJob.Heartbeat, opts: { removeOnComplete: true } },
    );

    this.logger.log(
      'system queue primed: boot ping enqueued + heartbeat scheduled (every 15m)',
    );
  }
}
