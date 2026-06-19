import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { QueueModule } from './queue/queue.module';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { RoutinesModule } from './routines/routines.module';

@Module({
  imports: [QueueModule, PrismaModule, RoutinesModule],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
