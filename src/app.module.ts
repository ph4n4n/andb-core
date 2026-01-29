import { Module } from '@nestjs/common';
import { GenerateCommand } from './cli/commands/generate.command';
import { HelperCommand } from './cli/commands/helper.command';

@Module({
  imports: [],
  controllers: [],
  providers: [GenerateCommand, HelperCommand],
})
export class AppModule {}
