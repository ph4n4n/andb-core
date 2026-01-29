import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { ISchemaDiff, IObjectDiff } from '../../common/interfaces/schema.interface';

@Injectable()
export class ReporterService {
  private readonly logger = new Logger(ReporterService.name);

  async generateHtmlReport(
    env: string,
    dbName: string,
    diff: ISchemaDiff,
    outputPath: string,
  ): Promise<string> {
    const templatePath = path.join(__dirname, 'templates', 'template.html');

    // If template doesn't exist in build folder, try source folder
    let resolvedTemplatePath = templatePath;
    if (!fs.existsSync(resolvedTemplatePath)) {
      resolvedTemplatePath = path.join(
        process.cwd(),
        'src',
        'modules',
        'reporter',
        'templates',
        'template.html',
      );
    }

    if (!fs.existsSync(resolvedTemplatePath)) {
      throw new Error(`Report template not found: ${resolvedTemplatePath}`);
    }

    const template = fs.readFileSync(resolvedTemplatePath, 'utf8');

    const categories = ['Tables', 'Views', 'Procedures', 'Functions', 'Triggers', 'Events'];

    // Summary calculation
    const newData = [0, 0, 0, 0, 0, 0];
    const updatedData = [0, 0, 0, 0, 0, 0];
    const deprecatedData = [diff.droppedTables.length, 0, 0, 0, 0, 0];

    // Count changes
    for (const tableName in diff.tables) {
      if (diff.tables[tableName].operations.length > 0) {
        updatedData[0]++;
      }
    }

    diff.objects.forEach((obj: IObjectDiff) => {
      const idx = this._getCategoryIndex(obj.type);
      if (obj.operation === 'CREATE') newData[idx]++;
      else if (obj.operation === 'REPLACE') updatedData[idx]++;
      else if (obj.operation === 'DROP') deprecatedData[idx]++;
    });

    const replacements: Record<string, string> = {
      '{{ENV}}': env,
      '{{CHART_CATEGORIES}}': JSON.stringify(categories),
      '{{TOTAL_DDL}}': JSON.stringify([0, 0, 0, 0, 0, 0]), // TODO: Need real totals
      '{{NEW_DDL}}': JSON.stringify(newData),
      '{{UPDATED_DDL}}': JSON.stringify(updatedData),
      '{{DEPRECATED_DDL}}': JSON.stringify(deprecatedData),
      '{{MISSING_COLUMNS}}': '{}',
      '{{STYLE4MISSING}}': 'display:none',
    };

    // Replace DDL lists
    this._addListReplacements(replacements, diff);

    let reportHTML = template;
    for (const [key, value] of Object.entries(replacements)) {
      reportHTML = reportHTML.split(key).join(value);
    }

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, reportHTML);

    this.logger.log(`Generated HTML report: ${outputPath}`);
    return outputPath;
  }

  private _getCategoryIndex(type: string): number {
    switch (type) {
      case 'VIEW':
        return 1;
      case 'PROCEDURE':
        return 2;
      case 'FUNCTION':
        return 3;
      case 'TRIGGER':
        return 4;
      case 'EVENT':
        return 5;
      default:
        return 0;
    }
  }

  private _addListReplacements(replacements: Record<string, string>, diff: ISchemaDiff) {
    const types = ['TABLE', 'VIEW', 'PROCEDURE', 'FUNCTION', 'TRIGGER', 'EVENT'];

    types.forEach((type) => {
      let newHtml = '';
      let updatedHtml = '';
      let droppedHtml = '';

      if (type === 'TABLE') {
        for (const tableName in diff.tables) {
          if (diff.tables[tableName].operations.length > 0) {
            updatedHtml += `<li>${tableName}</li>`;
          }
        }
        diff.droppedTables.forEach((t: string) => {
          droppedHtml += `<li>${t}</li>`;
        });
      } else {
        diff.objects
          .filter((o: IObjectDiff) => o.type === type)
          .forEach((obj: IObjectDiff) => {
            if (obj.operation === 'CREATE') newHtml += `<li>${obj.name}</li>`;
            else if (obj.operation === 'REPLACE') updatedHtml += `<li>${obj.name}</li>`;
            else if (obj.operation === 'DROP') droppedHtml += `<li>${obj.name}</li>`;
          });
      }

      replacements[`{{${type}_NEW}}`] = newHtml || '<li class="empty-state">No changes</li>';
      replacements[`{{${type}_UPDATE}}`] = updatedHtml || '<li class="empty-state">No changes</li>';
      replacements[`{{${type}_DEPRECATED}}`] =
        droppedHtml || '<li class="empty-state">No changes</li>';
    });
  }
}
