import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

export async function bootstrapCore() {
  const app = await NestFactory.createApplicationContext(AppModule);
  return app;
}
