import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

export * from './common/constants/tokens';
export * from './core-bridge';

export async function bootstrapCore() {
  const app = await NestFactory.createApplicationContext(AppModule);
  return app;
}

export * from './modules/storage/storage.service';
export * from './modules/storage/storage.module';
export * from './modules/config/project-config.service';
export * from './modules/config/project-config.module';
export * from './modules/driver/driver-factory.service';
export * from './modules/driver/driver.module';
export * from './modules/comparator/comparator.service';
export * from './modules/comparator/comparator.module';
export * from './modules/migrator/migrator.service';
export * from './modules/migrator/migrator.module';
export * from './modules/exporter/exporter.service';
export * from './modules/exporter/exporter.module';
export * from './modules/reporter/reporter.service';
export * from './modules/reporter/reporter.module';
