import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { ROUTINES_QUEUE, RoutineJob } from './routines.constants';
import { generateTodayRoutineTasks } from './generate-routine-tasks';

/**
 * Handles the daily routine-generation job. One job iterates all users and
 * generates today's routine tasks for each (single loop, not fan-out — fine
 * for the current scale; the lazy page-load path covers anyone this misses).
 */
@Processor(ROUTINES_QUEUE)
export class RoutinesProcessor extends WorkerHost {
  private readonly logger = new Logger(RoutinesProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name !== RoutineJob.GenerateDaily) {
      this.logger.warn(`unknown job name: ${job.name}`);
      return;
    }

    const users = await this.prisma.user.findMany({ select: { id: true } });
    let total = 0;
    for (const user of users) {
      const created = await generateTodayRoutineTasks(this.prisma, user.id);
      total += created;
      if (created > 0) {
        this.logger.log(
          `user ${user.id}: generated ${created} routine task(s)`,
        );
      }
    }
    this.logger.log(
      `routine generation complete: ${total} task(s) across ${users.length} user(s)`,
    );
  }
}
