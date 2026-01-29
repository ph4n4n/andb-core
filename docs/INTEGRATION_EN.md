# Integration Guide - @the-andb/core-nest

## Overview

`@the-andb/core-nest` provides a modern, type-safe API built on NestJS. It can be integrated into other NestJS applications or used programmatically in standalone scripts.

## Installation

```bash
npm install @the-andb/core-nest
```

## Programmatic Usage (Standalone)

If you are not using NestJS for your entire application, you can still leverage the core logic by bootstrapping the NestJS container manually.

```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ComparatorService } from './modules/comparator/comparator.service';
import { DriverFactoryService } from './modules/driver/driver-factory.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const comparator = app.get(ComparatorService);
  const driverFactory = app.get(DriverFactoryService);

  // Use the services
  const driver = await driverFactory.create('mysql', {
    host: 'localhost',
    user: 'root',
    database: 'my_db',
  });

  const tables = await driver.getIntrospectionService().listTables('my_db');
  console.log('Tables:', tables);

  await app.close();
}

bootstrap();
```

## Integration in NestJS Apps

### 1. Import Modules

Import the necessary modules into your feature module or `AppModule`.

```typescript
import { Module } from '@nestjs/common';
import { ComparatorModule } from '@the-andb/core-nest';
import { DriverModule } from '@the-andb/core-nest';

@Module({
  imports: [
    ComparatorModule,
    DriverModule.forRoot('mysql', {
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      // ...
    }),
  ],
})
export class MyFeatureModule {}
```

### 2. Inject Services

Inject the core services into your controllers or services.

```typescript
import { Injectable } from '@nestjs/common';
import { ComparatorService } from '@the-andb/core-nest';

@Injectable()
export class SyncService {
  constructor(private readonly comparator: ComparatorService) {}

  async syncTables(srcDDL: string, destDDL: string) {
    const diff = this.comparator.compareTables(srcDDL, destDDL);
    // ...
  }
}
```

## Core Modules & Services

- **`ParserModule`**: Provides `ParserService` for parsing and normalizing DDL.
- **`DriverModule`**: Provides `DriverFactoryService` to create database drivers (`MysqlDriver`, `DumpDriver`).
- **`ComparatorModule`**: Provides `ComparatorService` for deep-diffing database objects.
- **`MigratorModule`**: Provides `MigratorService` for generating migration SQL.

## Configuration (andb.yaml)

The project configuration is managed by `ProjectConfigService`, which automatically loads `andb.yaml` from the current working directory.

```yaml
ENVIRONMENTS:
  - DEV
  - PROD
getDBDestination:
  DEV:
    host: localhost
    database: dev_db
  PROD:
    host: prod.server.com
    database: prod_db
```

## Best Practices

1. **Type Safety**: Always use the provided interfaces for DDL objects and diff operations.
2. **Dependency Injection**: Favor DI over manual instantiation to leverage NestJS's lifecycle and testing capabilities.
3. **Async/Await**: All database and IO operations are asynchronous.
