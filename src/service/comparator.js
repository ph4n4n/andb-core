/**
 * @anph/core Comparator Service - Database comparison and migration
 * 
 * @author ph4n4n
 * @version 1.0.0
 * @license MIT
 * @description Service for comparing and migrating database structures
 * 
 * Copyright (c) 2024 ph4n4n
 * https://github.com/ph4n4n/@anph/core
 */
const path = require('path');
const {
  DDL: { FUNCTIONS, PROCEDURES, TABLES, TRIGGERS, VIEWS, EVENTS },
  DOMAIN_NORMALIZATION
} = require('../configs/constants');
const { diffWords } = require('diff');

module.exports = class ComparatorService {
  constructor(dependencies) {
    for (const key in dependencies) {
      this[key] = dependencies[key];
    }

    // Unified Storage strategy (File/SQLite/Hybrid)
    this.storage = dependencies.storage || null;

    // Domain normalization config (can be overridden via dependencies)
    this.domainNormalization = dependencies.domainNormalization || DOMAIN_NORMALIZATION;
  }

  async getDriverSubServices(env) {
    const dbConfig = this.getDBDestination(env);
    const driver = await this.driver(dbConfig);
    return {
      parser: driver.getDDLParser(),
      generator: driver.getDDLGenerator(),
      driver
    };
  }

  compareTriggers(srcTrigger, destTrigger) {
    if (!destTrigger) {
      return { hasChanges: true, differences: ['Trigger does not exist in destination'] };
    }

    const differences = [];

    if (srcTrigger.timing !== destTrigger.timing) {
      differences.push(`Timing changed from ${destTrigger.timing} to ${srcTrigger.timing}`);
    }

    if (srcTrigger.event !== destTrigger.event) {
      differences.push(`Event changed from ${destTrigger.event} to ${srcTrigger.event}`);
    }

    if (srcTrigger.tableName !== destTrigger.tableName) {
      differences.push(`Table changed from ${destTrigger.tableName} to ${srcTrigger.tableName}`);
    }

    if (srcTrigger.definition !== destTrigger.definition) {
      differences.push('Definition changed');
    }

    return {
      hasChanges: differences.length > 0,
      differences
    };
  }

  async reportTableStructureChange(env, tables = [], specificName = null) {
    try {
      if (specificName && tables.length > 0 && !tables.includes(specificName)) return;

      const srcEnv = this.getSourceEnv(env);
      const tablePath = this._getMigrationPath(srcEnv, env, TABLES);

      const alterColumnsList = this._readList(tablePath, 'alter-columns.list', specificName);
      const alterIndexesList = this._readList(tablePath, 'alter-indexes.list', specificName);

      if (!alterColumnsList.length && !alterIndexesList.length) return;

      this._logTableChangesSummary(alterColumnsList, alterIndexesList);
      await this._logDetailedTableChanges(alterColumnsList, alterIndexesList, env);

    } catch (error) {
      if (global.logger) global.logger.error('Error in reportTableStructureChange:', error);
    }
  }

  _getMigrationPath(srcEnv, destEnv, ddlType) {
    const mapFolder = path.join(`map-migrate`, `${srcEnv}-to-${destEnv}`);
    const mapMigrateFolder = `${mapFolder}/${this.getDBName(srcEnv)}`;
    this.fileManager.makeSureFolderExisted(mapMigrateFolder);
    return ddlType ? `${mapMigrateFolder}/${ddlType}` : mapMigrateFolder;
  }

  _readList(folder, fileName, specificName) {
    let list = this.fileManager.readFromFile(folder, fileName, 1);
    return specificName ? list.filter(t => t === specificName) : list;
  }

  _logTableChangesSummary(columnsList, indexesList) {
    if (!global.logger) return;
    global.logger.info(`📋 Found ${columnsList.length} tables with column changes`);
    global.logger.info(`📋 Found ${indexesList.length} tables with index changes`);
    if (columnsList.length > 0) global.logger.info(`📋 Tables with column changes: ${columnsList.join(', ')}`);
    if (indexesList.length > 0) global.logger.info(`📋 Tables with index changes: ${indexesList.join(', ')}`);
  }

  async _logDetailedTableChanges(columnsList, indexesList, env) {
    for (const tableName of columnsList) {
      const alterSQL = await this.checkDiffAndGenAlter(tableName, env);
      if (global.logger && alterSQL.columns) {
        global.logger.info(`📋 Table \`${tableName}\` has column changes: ${alterSQL.columns}`);
      }
    }
    for (const tableName of indexesList) {
      const alterSQL = await this.checkDiffAndGenAlter(tableName, env);
      if (global.logger && alterSQL.indexes) {
        global.logger.info(`📋 Index changes for ${tableName}: ${alterSQL.indexes}`);
      }
    }
  }

  updateReport(env, alterType, mapMigrateFolder, tblNeedAlters, keyChanges) {
    const reportFolder = `${mapMigrateFolder}/${TABLES}`;
    this.fileManager.makeSureFolderExisted(reportFolder);
    this.fileManager.saveToFile(reportFolder, `alter-${alterType}.list`, tblNeedAlters.join('\n'));
  }

  writeAlter(env, tableName, type, alters) {
    const alterFolder = `map-migrate/${this.getSourceEnv(env)}-to-${env}/${this.getDBName(this.getSourceEnv(env))}/${TABLES}/alters/${type}`;
    this.fileManager.makeSureFolderExisted(alterFolder);
    this.fileManager.saveToFile(alterFolder, `${tableName}.sql`, alters);
  }

  async checkDiffAndGenAlter(tableName, env) {
    let srcContent, destContent;
    const srcEnv = this.getSourceEnv(env);
    const srcDbName = this.getDBName(srcEnv);
    const destDbName = this.getDBName(env);

    if (this.storage) {
      srcContent = await this.storage.getDDL(srcEnv, srcDbName, TABLES, tableName);
      destContent = await this.storage.getDDL(env, destDbName, TABLES, tableName);
    } else {
      const srcFolder = `db/${srcEnv}/${srcDbName}/tables`;
      const destFolder = `db/${env}/${destDbName}/tables`;
      srcContent = this.fileManager.readFromFile(srcFolder, `${tableName}.sql`);
      destContent = this.fileManager.readFromFile(destFolder, `${tableName}.sql`);
    }

    if (!srcContent) {
      return { msg: `Table: ${srcEnv}:"${tableName}" not existed!` };
    }

    if (!destContent) {
      return { msg: `Table: ${env}:"${tableName}" not existed!` };
    }

    const { parser, generator, driver } = await this.getDriverSubServices(env);

    try {
      const srcTableDefinition = parser.parseTable(srcContent);
      const destTableDefinition = parser.parseTable(destContent);

      if (!srcTableDefinition || !destTableDefinition) {
        return { msg: `Error parsing table definition for ${tableName}` };
      }

      return generator.generateTableAlter(srcTableDefinition, destTableDefinition);
    } finally {
      await driver.disconnect();
    }
  }

  async markNewDDL(reportDDLFolder, srcLines, destLines, ddlType, srcEnv, destEnv) {
    const newLines = srcLines.filter(line => !destLines.includes(line)).filter(Boolean);

    for (const name of newLines) {
      const content = this.storage ? await this.storage.getDDL(srcEnv, this.getDBName(srcEnv), ddlType, name) : null;
      await this._saveComparison(srcEnv, destEnv, ddlType, name, 'new', content || content);
    }

    if (!this.storage) {
      this._saveFileList(reportDDLFolder, 'new.list', newLines);
      if ([PROCEDURES, FUNCTIONS].includes(ddlType)) {
        const oteLines = newLines.filter(line => line.indexOf('OTE_') > -1);
        this._saveFileList(reportDDLFolder, 'ote.list', oteLines);
      }
    }

    const result = { [`${ddlType}_new`]: newLines.length };
    if ([PROCEDURES, FUNCTIONS].includes(ddlType)) {
      result[`${ddlType}_ote`] = newLines.filter(line => line.indexOf('OTE_') > -1).length;
    }
    return result;
  }

  async _saveComparison(srcEnv, destEnv, type, name, status, alterStatements = null) {
    if (this.storage) {
      await this.storage.saveComparison({
        srcEnv, destEnv, status, type, name,
        database: this.getDBName(srcEnv),
        alterStatements
      });
    }
  }

  _saveFileList(folder, fileName, lines) {
    this.fileManager.makeSureFolderExisted(folder);
    this.fileManager.saveToFile(folder, fileName, lines.sort().join('\n'));
  }

  async markDeprecatedDDL(reportDDLFolder, srcLines, destLines, ddlType, srcEnv, destEnv) {
    const deprecatedLines = destLines.filter(line => !srcLines.includes(line));

    for (const name of deprecatedLines) {
      await this._saveComparison(srcEnv, destEnv, ddlType, name, 'deprecated');
    }

    if (!this.storage) {
      this._saveFileList(reportDDLFolder, 'deprecated.list', deprecatedLines);
    }

    return { [`${ddlType}_deprecated`]: deprecatedLines.length };
  }

  async markChangeDDL(reportDDLFolder, srcLines, destLines, ddlType, srcEnv, destEnv) {
    const existedDDL = srcLines.filter(line => destLines.includes(line));
    const updatedLines = [];
    const equalLines = [];

    const checkChanged = await this.findDDLChanged2Migrate(srcEnv, ddlType, destEnv);
    for (const ddlName of existedDDL) {
      if (await this._hasRealChange(ddlName, ddlType, destEnv, checkChanged)) {
        updatedLines.push(ddlName);
      } else {
        equalLines.push(ddlName);
      }
    }

    await this._processUpdatedLines(updatedLines, srcEnv, destEnv, ddlType, reportDDLFolder);
    await this._processEqualLines(equalLines, srcEnv, destEnv, ddlType);

    if (!this.storage && updatedLines.length > 0) {
      this._saveFileList(reportDDLFolder, 'updated.list', updatedLines);
    }

    return {
      [`${ddlType}_updated`]: updatedLines.length,
      [`${ddlType}_equal`]: equalLines.length
    };
  }

  async _hasRealChange(name, type, env, checkFn) {
    let hasChange = await checkFn(name);
    if (hasChange && type === TABLES) {
      const alterResult = await this.checkDiffAndGenAlter(name, env);
      return (alterResult.columns?.length > 0) || (alterResult.indexes?.length > 0) || (alterResult.deprecated?.length > 0);
    }
    return hasChange;
  }

  async _processUpdatedLines(lines, srcEnv, destEnv, type, reportFolder) {
    for (const name of lines) {
      let alterStatements = null;
      if (type === TABLES) {
        const alterResult = await this.checkDiffAndGenAlter(name, destEnv);
        alterStatements = [alterResult.columns, alterResult.indexes, alterResult.deprecated].filter(Boolean);
        await this.generateTableAlterFiles([name], srcEnv, destEnv, reportFolder);
      } else {
        alterStatements = this.storage ? await this.storage.getDDL(srcEnv, this.getDBName(srcEnv), type, name) : null;
      }
      await this._saveComparison(srcEnv, destEnv, type, name, 'updated', alterStatements);
    }
  }

  async _processEqualLines(lines, srcEnv, destEnv, type) {
    for (const name of lines) {
      await this._saveComparison(srcEnv, destEnv, type, name, 'equal');
    }
  }

  async generateTableAlterFiles(updatedTables, srcEnv, destEnv, reportDDLFolder) {
    const alterColumnsList = [];
    const alterIndexesList = [];

    for (const tableName of updatedTables) {
      const alterResult = await this.checkDiffAndGenAlter(tableName, destEnv);

      if (alterResult.columns && alterResult.columns.length > 0) {
        alterColumnsList.push(tableName);
        this.writeAlter(destEnv, tableName, 'columns', alterResult.columns);
      }

      if (alterResult.indexes && alterResult.indexes.length > 0) {
        alterIndexesList.push(tableName);
        this.writeAlter(destEnv, tableName, 'indexes', alterResult.indexes);
      }

      if (alterResult.deprecated && alterResult.deprecated.length > 0) {
        this.writeAlter(destEnv, tableName, 'deprecated', alterResult.deprecated);
      }
    }

    if (alterColumnsList.length > 0) {
      this.fileManager.saveToFile(reportDDLFolder, 'alter-columns.list', alterColumnsList.join('\n'));
    }
    if (alterIndexesList.length > 0) {
      this.fileManager.saveToFile(reportDDLFolder, 'alter-indexes.list', alterIndexesList.join('\n'));
    }
  }

  async findDDLChanged2Migrate(srcEnv, ddlType, destEnv) {
    const { parser, driver } = await this.getDriverSubServices(destEnv);
    return async name => {
      try {
        const [srcContent, destContent] = await Promise.all([
          this._getDDLContent(srcEnv, ddlType, name),
          this._getDDLContent(destEnv, ddlType, name)
        ]);

        if (!srcContent || !destContent) return false;

        const normalizedSrc = parser.normalize(this._applyDomainNormalization(srcContent.toString()));
        const normalizedDest = parser.normalize(this._applyDomainNormalization(destContent.toString()));

        if (normalizedSrc !== normalizedDest) {
          this._logDetailedDiff(srcEnv, destEnv, ddlType, name, srcContent, destContent);
          return true;
        }
        return false;
      } finally {
        await driver.disconnect();
      }
    };
  }

  async _getDDLContent(env, type, name) {
    if (this.storage) return await this.storage.getDDL(env, this.getDBName(env), type, name);
    return this.fileManager.readFromFile(`db/${env}/${this.getDBName(env)}/${type}`, `${name}.sql`);
  }

  _applyDomainNormalization(content) {
    return content.replace(this.domainNormalization.pattern, this.domainNormalization.replacement);
  }

  _logDetailedDiff(srcEnv, destEnv, type, name, src, dest) {
    if (global.logger) {
      global.logger.info('=======================================');
      this.logDiff(this._applyDomainNormalization(src.toString()), this._applyDomainNormalization(dest.toString()));
      global.logger.info('=======================================');
    }
    this.vimDiffToHtml(destEnv, type, name,
      `${srcEnv}/${this.getDBName(srcEnv)}/${type}`,
      `${destEnv}/${this.getDBName(destEnv)}/${type}`,
      `${name}.sql`
    );
  }

  async reportDLLChange(srcEnv, ddlType, destEnv = null, specificName = null) {
    try {
      destEnv = this.getDestinationEnvironment(srcEnv, destEnv);
      if (destEnv === srcEnv) return;

      const mapMigrateFolder = this.setupMigrationFolder(srcEnv, destEnv);
      let { srcLines, destLines } = await this.loadDDLContent(srcEnv, destEnv, ddlType, specificName);

      if (!srcLines.length && !destLines.length) return;

      if (global.logger) global.logger.info('Comparing...', srcLines.length, '->', destLines.length, ddlType, specificName ? `(${specificName})` : '');

      if (ddlType === TRIGGERS) {
        await this.handleTriggerComparison(srcEnv, destEnv, mapMigrateFolder);
      }

      const newDDL = await this.processNewDDL(mapMigrateFolder, srcLines, destLines, ddlType, srcEnv, destEnv);
      const updatedDDL = await this.processUpdatedDDL(mapMigrateFolder, srcLines, destLines, ddlType, srcEnv, destEnv);
      const deprecatedDDL = await this.processDeprecatedDDL(mapMigrateFolder, srcLines, destLines, ddlType, srcEnv, destEnv);

      // Log detailed comparison results
      if (global.logger) {
        const newCount = newDDL[`${ddlType}_new`] || 0;
        const updatedCount = updatedDDL[`${ddlType}_updated`] || 0;
        const deprecatedCount = deprecatedDDL[`${ddlType}_deprecated`] || 0;
        const equalCount = updatedDDL[`${ddlType}_equal`] || 0;
        const totalChanges = newCount + updatedCount + deprecatedCount;

        global.logger.info(`\n📊 Comparison Results for ${ddlType}:`);
        global.logger.info(`  ✨ New: ${newCount}`);
        global.logger.info(`  🔄 Updated: ${updatedCount}`);
        global.logger.info(`  ⚠️  Deprecated: ${deprecatedCount}`);
        global.logger.info(`  ✅ Equal: ${equalCount}`);
        global.logger.info(`  📈 Total changes: ${totalChanges}`);

        if (totalChanges === 0) {
          global.logger.info(`  ✅ No changes detected - environments are in sync`);
        }
      }

      await this.generateReports(destEnv, { ...newDDL, ...deprecatedDDL, ...updatedDDL });
    } catch (error) {
      if (global.logger) global.logger.error('Error in reportDLLChange:', error);
    }
  }

  async reportTriggerChange(srcEnv, destEnv = null, specificName = null) {
    try {
      destEnv = this.getDestinationEnvironment(srcEnv, destEnv);
      if (destEnv === srcEnv) return;

      const mapMigrateFolder = this.setupMigrationFolder(srcEnv, destEnv);
      let { srcLines, destLines } = await this.loadDDLContent(srcEnv, destEnv, TRIGGERS, specificName);

      if (global.logger) global.logger.info('Comparing triggers...', srcLines.length, '->', destLines.length, specificName ? `(${specificName})` : '');

      const newTriggers = await this.processNewDDL(mapMigrateFolder, srcLines, destLines, TRIGGERS, srcEnv, destEnv);
      const updatedTriggers = await this.processUpdatedDDL(mapMigrateFolder, srcLines, destLines, TRIGGERS, srcEnv, destEnv);
      const deprecatedTriggers = await this.processDeprecatedDDL(mapMigrateFolder, srcLines, destLines, TRIGGERS, srcEnv, destEnv);

      await this.generateReports(destEnv, { ...newTriggers, ...deprecatedTriggers, ...updatedTriggers });
    } catch (error) {
      if (global.logger) global.logger.error('Error in reportTriggerChange:', error);
    }
  }

  getDestinationEnvironment(srcEnv, destEnv) {
    if (!destEnv) {
      destEnv = this.getDestEnv(srcEnv);
    }
    return destEnv;
  }

  setupMigrationFolder(srcEnv, destEnv) {
    const mapFolder = `map-migrate/${srcEnv}-to-${destEnv}`;
    const mapMigrateFolder = `${mapFolder}/${this.getDBName(srcEnv)}`;
    this.fileManager.makeSureFolderExisted(mapMigrateFolder);
    return mapMigrateFolder;
  }

  async loadDDLContent(srcEnv, destEnv, ddlType, specificName = null) {
    let srcLines = [];
    let destLines = [];

    if (this.storage) {
      srcLines = await this.storage.getDDLList(srcEnv, this.getDBName(srcEnv), ddlType);
      destLines = await this.storage.getDDLList(destEnv, this.getDBName(destEnv), ddlType);
    } else {
      const srcContent = this.fileManager.readFromFile(`db/${srcEnv}/${this.getDBName(srcEnv)}/current-ddl`, `${ddlType}.list`);
      const destContent = this.fileManager.readFromFile(`db/${destEnv}/${this.getDBName(destEnv)}/current-ddl`, `${ddlType}.list`);
      srcLines = srcContent ? srcContent.split('\n').map(line => line.trim()).filter(l => l) : [];
      destLines = destContent ? destContent.split('\n').map(line => line.trim()).filter(l => l) : [];
    }

    if (specificName) {
      srcLines = srcLines.filter(line => line === specificName);
      destLines = destLines.filter(line => line === specificName);
    }

    return { srcLines: srcLines.sort(), destLines: destLines.sort() };
  }

  async handleTriggerComparison(srcEnv, destEnv, mapMigrateFolder, specificName = null) {
    let { srcLines, destLines } = await this.loadDDLContent(srcEnv, destEnv, TRIGGERS, specificName);
    const srcTriggers = await this.parseTriggerList(srcEnv, srcLines, destEnv);
    const destTriggers = await this.parseTriggerList(destEnv, destLines, destEnv);
    const triggerChanges = this.compareTriggerLists(srcTriggers, destTriggers);

    if (triggerChanges.length > 0) {
      this.saveTriggerChanges(mapMigrateFolder, triggerChanges, specificName);
    }
  }

  async parseTriggerList(env, lines, destEnv) {
    const list = [];
    const { parser, driver } = await this.getDriverSubServices(destEnv);
    try {
      for (const line of lines) {
        let content;
        if (this.storage) {
          content = await this.storage.getDDL(env, this.getDBName(env), TRIGGERS, line);
        } else {
          content = this.fileManager.readFromFile(`db/${env}/${this.getDBName(env)}/triggers`, `${line}.sql`);
        }
        const parsed = parser.parseTrigger(content);
        if (parsed) list.push(parsed);
      }
    } finally {
      await driver.disconnect();
    }
    return list;
  }

  compareTriggerLists(srcTriggers, destTriggers) {
    const triggerChanges = [];
    const duplicateWarnings = [];

    const srcDuplicates = this.findDuplicateTriggers(srcTriggers);
    if (srcDuplicates.length > 0) duplicateWarnings.push({ type: 'source_duplicates', duplicates: srcDuplicates });

    const destDuplicates = this.findDuplicateTriggers(destTriggers);
    if (destDuplicates.length > 0) duplicateWarnings.push({ type: 'destination_duplicates', duplicates: destDuplicates });

    for (const srcTrigger of srcTriggers) {
      const destTrigger = destTriggers.find(t => t.triggerName === srcTrigger.triggerName);
      const comparison = this.compareTriggers(srcTrigger, destTrigger);
      if (comparison?.hasChanges) {
        triggerChanges.push({ triggerName: srcTrigger.triggerName, changes: comparison.differences });
      }
    }

    if (duplicateWarnings.length > 0) this.logDuplicateTriggerWarnings(duplicateWarnings);
    return triggerChanges;
  }

  findDuplicateTriggers(triggers) {
    const duplicates = [];
    const triggerGroups = {};
    for (const trigger of triggers) {
      const key = `${trigger.tableName}_${trigger.event}_${trigger.timing}`;
      if (!triggerGroups[key]) triggerGroups[key] = [];
      triggerGroups[key].push(trigger);
    }
    for (const [key, triggerList] of Object.entries(triggerGroups)) {
      if (triggerList.length > 1) {
        const [tableName, event, timing] = key.split('_');
        duplicates.push({ tableName, event, timing, triggers: triggerList.map(t => t.triggerName), count: triggerList.length });
      }
    }
    return duplicates;
  }

  logDuplicateTriggerWarnings(warnings) {
    for (const warning of warnings) {
      const envType = warning.type === 'source_duplicates' ? 'SOURCE' : 'DESTINATION';
      if (global.logger) {
        global.logger.warn(`⚠️  DUPLICATE TRIGGERS FOUND in ${envType} environment:`);
        for (const duplicate of warning.duplicates) {
          global.logger.warn(`   Table: ${duplicate.tableName}`);
          global.logger.warn(`   Event: ${duplicate.event} ${duplicate.timing}`);
          global.logger.warn(`   Triggers (${duplicate.count}): ${duplicate.triggers.join(', ')}`);
        }
      }
    }
  }

  saveTriggerChanges(mapMigrateFolder, triggerChanges) {
    const reportFolder = `${mapMigrateFolder}/triggers`;
    this.fileManager.makeSureFolderExisted(reportFolder);
    this.fileManager.saveToFile(reportFolder, 'trigger-changes.json', JSON.stringify(triggerChanges, null, 2));
  }

  async processNewDDL(mapMigrateFolder, srcLines, destLines, ddlType, srcEnv, destEnv) {
    return await this.markNewDDL(`${mapMigrateFolder}/${ddlType}`, srcLines, destLines, ddlType, srcEnv, destEnv);
  }

  async processUpdatedDDL(mapMigrateFolder, srcLines, destLines, ddlType, srcEnv, destEnv) {
    return await this.markChangeDDL(`${mapMigrateFolder}/${ddlType}`, srcLines, destLines, ddlType, srcEnv, destEnv);
  }

  async processDeprecatedDDL(mapMigrateFolder, srcLines, destLines, ddlType, srcEnv, destEnv) {
    return await this.markDeprecatedDDL(`${mapMigrateFolder}/${ddlType}`, srcLines, destLines, ddlType, srcEnv, destEnv);
  }

  async generateReports(destEnv, allChanges) {
    await this.appendReport(destEnv, allChanges);
    await this.report2html(destEnv);
  }

  async logDiff(srcContent, destContent) {
    if (global.logger) {
      global.logger.info('S:', srcContent);
      global.logger.warn('D:', destContent);
    }
    const differences = diffWords(srcContent, destContent);
    differences.forEach(part => {
      const color = part.added ? '\x1b[32m' : part.removed ? '\x1b[31m' : '\x1b[0m';
      process.stdout.write(color + part.value + '\x1b[0m');
    });
    process.stdout.write('\x1b[0m\n');
  }

  compare(ddl, specificName = null) {
    return async (env) => {
      if (global.logger) global.logger.warn(`Start comparing ${ddl} changes for...`, env, specificName ? `(${specificName})` : '');
      const srcEnv = this.getSourceEnv(env);
      switch (ddl) {
        case FUNCTIONS:
          await this.reportDLLChange(srcEnv, FUNCTIONS, env, specificName);
          break;
        case PROCEDURES:
          await this.reportDLLChange(srcEnv, PROCEDURES, env, specificName);
          break;
        case TABLES:
          await this.reportTableStructureChange(env, [], specificName);
          await this.reportDLLChange(srcEnv, TABLES, env, specificName);
          break;
        case VIEWS:
          await this.reportDLLChange(srcEnv, VIEWS, env, specificName);
          break;
        case TRIGGERS:
          await this.reportTriggerChange(srcEnv, env, specificName);
          break;
        case EVENTS:
          await this.reportDLLChange(srcEnv, EVENTS, env, specificName);
          break;
        default:
          this.report2console(env);
          break;
      }
    };
  }
}