import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { QueueModule } from './queue/queue.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [QueueModule],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
