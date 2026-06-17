import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { SYSTEM_QUEUE, SystemJob } from './system.constants';

/**
 * The worker. `@Processor('system')` spins up a BullMQ Worker bound to the
 * `system` queue; `process()` runs for each job pulled off it. This is the
 * shape PR #2's routine-generation worker will take — only the job bodies
 * change.
 */
@Processor(SYSTEM_QUEUE)
export class SystemProcessor extends WorkerHost {
  private readonly logger = new Logger(SystemProcessor.name);

  process(job: Job): Promise<void> {
    switch (job.name) {
      case SystemJob.Ping:
        this.logger.log(`ping processed (job ${job.id}) — queue round-trip OK`);
        break;
      case SystemJob.Heartbeat:
        this.logger.log(`heartbeat (job ${job.id}) — repeatable scheduler OK`);
        break;
      default:
        this.logger.warn(`unknown job name: ${job.name}`);
    }

    return Promise.resolve();
  }
}
