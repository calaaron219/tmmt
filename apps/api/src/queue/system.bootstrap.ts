import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { SYSTEM_QUEUE, SystemJob } from './system.constants';

/**
 * Runs once after the app (and worker) are ready:
 *  1. Enqueues a single `ping` — a per-boot liveness proof.
 *  2. Removes PR #1's demo `heartbeat` scheduler. `removeJobScheduler` is
 *     idempotent, so this safely clears the lingering Redis key on the first
 *     boot after this deploy and is a no-op thereafter.
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

    await this.queue.removeJobScheduler('system-heartbeat');

    this.logger.log(
      'system queue primed: boot ping enqueued; demo heartbeat retired',
    );
  }
}
