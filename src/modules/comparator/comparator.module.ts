import { Module } from '@nestjs/common';
import { ComparatorService } from './comparator.service';
import { ParserModule } from '../parser/parser.module';

@Module({
  imports: [ParserModule],
  providers: [ComparatorService],
  exports: [ComparatorService],
})
export class ComparatorModule {}
