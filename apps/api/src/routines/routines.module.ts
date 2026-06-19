import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ROUTINES_QUEUE } from './routines.constants';
import { RoutinesProcessor } from './routines.processor';
import { RoutinesScheduler } from './routines.scheduler';

/**
 * The routines worker: a `routines` queue, the processor that runs generation,
 * and the scheduler that fires it daily. PrismaService comes from the global
 * PrismaModule. The shared BullMQ connection comes from QueueModule's forRoot.
 */
@Module({
  imports: [BullModule.registerQueue({ name: ROUTINES_QUEUE })],
  providers: [RoutinesProcessor, RoutinesScheduler],
})
export class RoutinesModule {}
