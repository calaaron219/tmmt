import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Let Nest run module shutdown hooks on SIGTERM (Railway sends one on every
  // redeploy) so BullMQ workers close cleanly instead of dropping mid-job.
  app.enableShutdownHooks();
  // Railway injects PORT; locally default to 3001 so we don't collide with
  // the Next.js dev server on 3000.
  await app.listen(process.env.PORT ?? 3001);
}
void bootstrap();
