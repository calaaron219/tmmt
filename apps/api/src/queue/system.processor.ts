import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { SYSTEM_QUEUE, SystemJob } from './system.constants';

/**
 * The system liveness worker. Real scheduled work lives in the `routines`
 * queue (and future feature queues); this just proves the worker can pull a
 * job off Redis on boot.
 */
@Processor(SYSTEM_QUEUE)
export class SystemProcessor extends WorkerHost {
  private readonly logger = new Logger(SystemProcessor.name);

  process(job: Job): Promise<void> {
    if (job.name === SystemJob.Ping) {
      this.logger.log(`ping processed (job ${job.id}) — queue round-trip OK`);
    } else {
      this.logger.warn(`unknown job name: ${job.name}`);
    }

    return Promise.resolve();
  }
}
