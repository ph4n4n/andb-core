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
  DDL: { FUNCTIONS, PROCEDURES, TABLES, TRIGGERS },
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

  /**
   * 
   * @param {*} tableSQL 
   * @returns 
   */
  parseTableDefinition(tableSQL) {
    try {
      const lines = tableSQL.split('\n');
      const tableNameLine = lines.find(line => line.includes('CREATE TABLE'));
      const tableNameMatch = tableNameLine.match(/`([^`]+)`/);

      if (!tableNameMatch || tableNameMatch.length < 2) {
        return null;
      }
      const tableName = tableNameMatch[1];
      const columnDefs = [];
      const primaryKey = [];
      const indexes = {};
      let insideColumnDefinitions = false;
      let insideIndexDefinitions = false;

      for (const line of lines) {
        if (line.includes('CREATE TABLE')) {
          insideColumnDefinitions = true;
          continue;
        } else if (insideColumnDefinitions && line.trim().includes('ENGINE=InnoDB DEFAULT')) {
          // Reached the end of column definitions
          insideColumnDefinitions = false;
        } else if (line.includes('PRIMARY KEY') || line.includes('UNIQUE KEY') || line.includes('KEY')) {
          insideIndexDefinitions = true;
          const indexNameMatch = line.match(/`([^`]+)`/);
          if (indexNameMatch && indexNameMatch.length >= 2) {
            const indexName = indexNameMatch[1];
            if (line.includes('PRIMARY KEY')) {
              primaryKey.push(indexName);
            } else {
              indexes[indexName] = line.trim();
            }
          }
        } else if (insideColumnDefinitions && line.trim() !== '') {
          // Parse only non-empty lines inside column definitions
          const columnNameMatch = line.match(/`([^`]+)`/);
          if (!columnNameMatch || columnNameMatch.length < 2) {
            if (global.logger) global.logger.error('Error parsing column name');
            return null;
          }
          const columnName = columnNameMatch[1];
          columnDefs.push({
            name: columnName,
            definition: line.trim(),
          });
        } else if (insideIndexDefinitions && line.trim() === ')') {
          insideIndexDefinitions = false;
        }
      }

      const columns = {};
      for (const columnDef of columnDefs) {
        columns[columnDef.name] = columnDef.definition;
      }

      return {
        tableName,
        columns,
        primaryKey,
        indexes,
      };
    } catch (error) {
      if (global.logger) global.logger.error('Error parsing table definition:', error);
      return null;
    }
  }

  /**
   * Parse trigger definition from SQL
   * @param {string} triggerSQL 
   * @returns {Object|null} Parsed trigger definition or null if invalid
   */
  parseTriggerDefinition(triggerSQL) {
    try {
      const lines = triggerSQL.split('\n');
      // Fix: DEFINER clause might be present, so just look for TRIGGER keyword
      const triggerNameLine = lines.find(line => line.includes('TRIGGER') && line.includes('`'));
      // Fix: Look for TRIGGER keyword to avoid matching DEFINER=`root`
      const triggerNameMatch = triggerNameLine?.match(/TRIGGER\s+`([^`]+)`/);

      if (!triggerNameMatch || triggerNameMatch.length < 2) {
        if (global.logger) global.logger.error('Error parsing trigger name');
        return null;
      }

      const triggerName = triggerNameMatch[1];
      const timing = triggerNameLine.match(/(BEFORE|AFTER)/)?.[1];
      const event = triggerNameLine.match(/(INSERT|UPDATE|DELETE)/)?.[1];
      const tableName = triggerNameLine.match(/ON\s+`([^`]+)`/)?.[1];

      return {
        triggerName,
        timing,
        event,
        tableName,
        definition: triggerSQL
      };
    } catch (error) {
      if (global.logger) global.logger.error('Error parsing trigger definition:', error);
      return null;
    }
  }

  /**
   * 
   * @param {*} srcTableDefinition 
   * @param {*} destTableDefinition 
   * @returns 
   */
  generateAlterSQL(srcTableDefinition, destTableDefinition) {
    // 2. Compare columns
    const { alterColumns, missingColumns, missingColumnsAlter } = this.compareColumns(srcTableDefinition, destTableDefinition);
    // 3. Compare Indexes
    const alterIndexes = this.compareIndexes(srcTableDefinition, destTableDefinition);
    // 4. write it down
    const tableName = srcTableDefinition.tableName;
    return {
      columns: !alterColumns?.length
        ? null
        : this.generateAlter(tableName, alterColumns),
      indexes: !alterIndexes?.length
        ? null
        : this.generateAlter(tableName, alterIndexes),
      deprecated: !missingColumnsAlter?.length
        ? null
        : this.generateAlter(tableName, missingColumnsAlter),
      missingColumns
    };
  }

  /**
   * 
   * @param {*} tableName 
   * @param {*} alters 
   * @returns 
   */
  generateAlter(tableName, alters) {
    return `ALTER TABLE \`${tableName}\`\n${alters.join(',\n')};`
      .replace(/,,/g, ',')
      .replace(/,;/g, ';');
  }

  /**
   * 
   * @param {*} srcTableDefinition 
   * @param {*} destTableDefinition 
   * @returns 
   */
  compareColumns(srcTableDefinition, destTableDefinition) {
    const alterColumns = [];
    const missingColumns = [];
    const missingColumnsAlter = [];
    let prevColumnName = null;
    // Check if any columns are missing in the destination table
    for (const columnName in srcTableDefinition.columns) {
      if (!destTableDefinition.columns[columnName]) {
        alterColumns.push(`ADD COLUMN ${srcTableDefinition.columns[columnName].replace(/[,;]$/, '')} AFTER \`${prevColumnName || 'FIRST'}\``);
      }
      prevColumnName = columnName;
    }
    // Reset previous column for the next loop
    prevColumnName = null;

    // Check if any columns have different definitions or have been renamed
    for (const srcColName in srcTableDefinition.columns) {
      // not exist in dest
      if (!destTableDefinition.columns[srcColName]) {
        continue;
      }
      const srcColumnDef = srcTableDefinition.columns[srcColName];
      const destColumnDef = destTableDefinition.columns[srcColName];
      // same definition
      if (srcColumnDef === destColumnDef) {
        continue;
      }
      // detect change
      this.logDiff(srcColumnDef, destColumnDef);

      // detect source collation not defined
      const srcCollation = srcColumnDef.match(/COLLATE\s+(\w+)/)?.[1];
      if (srcCollation === undefined) {
        const destCollation = destColumnDef.match(/COLLATE\s+(\w+)/)?.[1];
        //check dest collation already latin1_swedish_ci
        if (destCollation === 'latin1_swedish_ci') {
          continue;
        }
        alterColumns.push(`MODIFY COLUMN ${srcColumnDef
          .replace(/\,$/, ` COLLATE latin1_swedish_ci,`)
          .replace(/ DEFAULT NULL/, '')
          }`);
        continue;
      }

      // Column definition has changed
      alterColumns.push(`MODIFY COLUMN ${srcColumnDef
        .replace(/ DEFAULT NULL/, '')
        }`);
    }

    // Check if any columns are missing in the source table
    for (const destColName in destTableDefinition.columns) {
      if (!srcTableDefinition.columns[destColName]) {
        missingColumns.push(destColName);
        missingColumnsAlter.push(`DROP COLUMN ${destColName}`);

      }
    }
    return { alterColumns, missingColumns, missingColumnsAlter };
  }

  /**
   * 
   * @param {*} srcTableDefinition 
   * @param {*} destTableDefinition 
   * @returns 
   */
  compareIndexes(srcTableDefinition, destTableDefinition) {
    const alterIndexes = [];

    // Check if any indexes are missing in the destination table
    for (const indexName in srcTableDefinition.indexes) {
      if (!destTableDefinition.indexes[indexName]) {
        alterIndexes.push(`ADD ${srcTableDefinition.indexes[indexName]}`);
      }
    }

    // Check if any indexes are missing in the source table (deprecated)
    for (const indexName in destTableDefinition.indexes) {
      if (!srcTableDefinition.indexes[indexName]) {
        alterIndexes.push(`DROP INDEX \`${indexName}\``);
      }
    }

    return alterIndexes;
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

  async reportTableStructureChange(env, tables = []) {
    try {
      const srcEnv = this.getSourceEnv(env);
      const mapFolder = path.join(`map-migrate`, `${srcEnv}-to-${env}`);
      const mapMigrateFolder = `${mapFolder}/${this.getDBName(srcEnv)}`;
      this.fileManager.makeSureFolderExisted(mapMigrateFolder);

      const tablePath = `${mapMigrateFolder}/${TABLES}`;
      const alterColumnsList = this.fileManager.readFromFile(tablePath, 'alter-columns.list', 1);
      const alterIndexesList = this.fileManager.readFromFile(tablePath, 'alter-indexes.list', 1);

      if (!alterColumnsList.length && !alterIndexesList.length) {
        return;
      }

      // Just report what changes would be made, no database connection needed
      if (global.logger) {
        global.logger.info(`📋 Found ${alterColumnsList.length} tables with column changes`);
        global.logger.info(`📋 Found ${alterIndexesList.length} tables with index changes`);
      }

      if (alterColumnsList.length > 0) {
        if (global.logger) global.logger.info(`📋 Tables with column changes: ${alterColumnsList.join(', ')}`);
      }
      if (alterIndexesList.length > 0) {
        if (global.logger) global.logger.info(`📋 Tables with index changes: ${alterIndexesList.join(', ')}`);
      }

      // Log detailed changes for each table
      for (const tableName of alterColumnsList) {
        const alterSQL = this.checkDiffAndGenAlter(tableName, env);
        if (global.logger) global.logger.info(`📋 Table \`${tableName}\` has column changes:`);
        if (alterSQL.columns) {
          if (global.logger) global.logger.info(`📋 Column changes for table \`${tableName}\`: ${alterSQL.columns}`);
        }
      }

      for (const tableName of alterIndexesList) {
        const alterSQL = this.checkDiffAndGenAlter(tableName, env);
        if (alterSQL.indexes) {
          if (global.logger) global.logger.info(`📋 Index changes for ${tableName}: ${alterSQL.indexes}`);
        }
      }

    } catch (error) {
      if (global.logger) global.logger.error('Error in reportTableStructureChange:', error);
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

  checkDiffAndGenAlter(tableName, env) {
    const srcFolder = `db/${this.getSourceEnv(env)}/${this.getDBName(this.getSourceEnv(env))}/tables`;
    const destFolder = `db/${env}/${this.getDBName(env)}/tables`;

    const srcContent = this.fileManager.readFromFile(srcFolder, `${tableName}.sql`);
    const destContent = this.fileManager.readFromFile(destFolder, `${tableName}.sql`);

    if (!srcContent) {
      return { msg: `Table: ${this.getSourceEnv(env)}:"${tableName}" not existed!` };
    }

    if (!destContent) {
      return { msg: `Table: ${env}:"${tableName}" not existed!` };
    }

    const srcTableDefinition = this.parseTableDefinition(srcContent);
    const destTableDefinition = this.parseTableDefinition(destContent);

    if (!srcTableDefinition || !destTableDefinition) {
      return { msg: `Error parsing table definition for ${tableName}` };
    }

    return this.generateAlterSQL(srcTableDefinition, destTableDefinition);
  }

  async markNewDDL(reportDDLFolder, srcLines, destLines, ddlType, destEnv) {
    const newDDLFile = `new.list`;
    const newLines = srcLines
      .filter(line => !destLines.includes(line)).filter(Boolean);

    // Unified Storage Strategy handles this
    if (this.storage) {
      if (newLines.length > 0) {
        for (const ddlName of newLines) {
          await this.storage.saveComparison({
            srcEnv: this.getSourceEnv(destEnv),
            destEnv,
            database: this.getDBName(this.getSourceEnv(destEnv)),
            type: ddlType,
            name: ddlName,
            status: 'new'
          });
        }
      }

      if ([PROCEDURES, FUNCTIONS].includes(ddlType)) {
        const oteLines = newLines.filter(line => line.indexOf('OTE_') > -1);
        return {
          [`${ddlType}_new`]: newLines.length,
          [`${ddlType}_ote`]: oteLines.length
        };
      }
      return { [`${ddlType}_new`]: newLines.length };
    }

    // Fallback: FileManager (backward compatible)
    this.fileManager.saveToFile(reportDDLFolder, newDDLFile, '');
    this.fileManager.makeSureFolderExisted(reportDDLFolder);
    this.fileManager.emptyDirectory(`reports/diff/${destEnv}/${this.getDBName(destEnv)}/${ddlType}`);

    if (newLines.length > 0) {
      const result = newLines.sort().join('\n');
      this.fileManager.saveToFile(reportDDLFolder, newDDLFile, result);
    }

    if ([PROCEDURES, FUNCTIONS].includes(ddlType)) {
      const oteDDL = `ote.list`;
      const oteLines = newLines.filter(line => line.indexOf('OTE_') > -1);
      if (oteLines.length > 0) {
        const oteResult = oteLines.sort().join('\n');
        this.fileManager.saveToFile(reportDDLFolder, oteDDL, oteResult);
      }
      return {
        [`${ddlType}_new`]: newLines.length,
        [`${ddlType}_ote`]: oteLines.length
      };
    }

    return { [`${ddlType}_new`]: newLines.length };
  }

  async markDeprecatedDDL(reportDDLFolder, srcLines, destLines, ddlType) {
    const deprecatedDDLFile = `deprecated.list`;
    const deprecatedLines = destLines.filter(
      line => !srcLines.includes(line)
    );

    // Unified Storage Strategy handles this
    if (this.storage) {
      if (deprecatedLines.length > 0) {
        for (const ddlName of deprecatedLines) {
          await this.storage.saveComparison({
            srcEnv: this.getSourceEnv(),
            destEnv: this.getDestEnv(),
            database: this.getDBName(this.getSourceEnv()),
            type: ddlType,
            name: ddlName,
            status: 'deprecated'
          });
        }
      }
      return { [`${ddlType}_deprecated`]: deprecatedLines.length };
    }

    // Fallback: FileManager
    this.fileManager.saveToFile(reportDDLFolder, deprecatedDDLFile, '');
    this.fileManager.makeSureFolderExisted(reportDDLFolder);

    if (deprecatedLines.length > 0) {
      const result = deprecatedLines.sort().join('\n');
      this.fileManager.saveToFile(reportDDLFolder, deprecatedDDLFile, result);
    }
    return { [`${ddlType}_deprecated`]: deprecatedLines.length };
  }

  async markChangeDDL(reportDDLFolder, srcLines, destLines, ddlType, srcEnv, destEnv) {
    const updatedDDLFile = `updated.list`;
    const existedDDL = srcLines.filter(line => destLines.includes(line));

    // Filter changed DDLs
    const updatedLines = [];
    const checkChanged = this.findDDLChanged2Migrate(srcEnv, ddlType, destEnv);
    for (const ddlName of existedDDL) {
      if (await checkChanged(ddlName)) {
        updatedLines.push(ddlName);
      }
    }

    // Unified Storage Strategy handles this
    if (this.storage) {
      if (updatedLines.length > 0) {
        for (const ddlName of updatedLines) {
          await this.storage.saveComparison({
            srcEnv,
            destEnv,
            database: this.getDBName(srcEnv),
            type: ddlType,
            name: ddlName,
            status: 'updated'
          });
        }
        if (ddlType === TABLES) {
          await this.generateTableAlterFiles(updatedLines, srcEnv, destEnv, reportDDLFolder);
        }
      }
      return { [`${ddlType}_updated`]: updatedLines.length };
    }

    // Fallback: FileManager
    this.fileManager.saveToFile(reportDDLFolder, updatedDDLFile, '');
    this.fileManager.makeSureFolderExisted(reportDDLFolder);
    this.fileManager.emptyDirectory(`reports/diff/${destEnv}/${this.getDBName(destEnv)}/${ddlType}`);

    if (updatedLines.length > 0) {
      const result = updatedLines.sort().join('\n');
      this.fileManager.saveToFile(reportDDLFolder, updatedDDLFile, result);
      if (ddlType === TABLES) {
        await this.generateTableAlterFiles(updatedLines, srcEnv, destEnv, reportDDLFolder);
      }
    }

    return { [`${ddlType}_updated`]: updatedLines.length };
  }

  async generateTableAlterFiles(updatedTables, srcEnv, destEnv, reportDDLFolder) {
    const alterColumnsList = [];
    const alterIndexesList = [];

    for (const tableName of updatedTables) {
      const alterResult = this.checkDiffAndGenAlter(tableName, destEnv);

      if (alterResult.columns && alterResult.columns.length > 0) {
        alterColumnsList.push(tableName);
        this.writeAlter(destEnv, tableName, 'columns', alterResult.columns);
      }

      if (alterResult.indexes && alterResult.indexes.length > 0) {
        alterIndexesList.push(tableName);
        this.writeAlter(destEnv, tableName, 'indexes', alterResult.indexes);
      }
    }

    if (alterColumnsList.length > 0) {
      this.fileManager.saveToFile(reportDDLFolder, 'alter-columns.list', alterColumnsList.join('\n'));
    }
    if (alterIndexesList.length > 0) {
      this.fileManager.saveToFile(reportDDLFolder, 'alter-indexes.list', alterIndexesList.join('\n'));
    }
  }

  findDDLChanged2Migrate(srcEnv, ddlType, destEnv) {
    return async ddlName => {
      let srcContent, destContent;

      if (this.storage) {
        srcContent = await this.storage.getDDL(srcEnv, this.getDBName(srcEnv), ddlType, ddlName);
        destContent = await this.storage.getDDL(destEnv, this.getDBName(destEnv), ddlType, ddlName);
      } else {
        const srcFolder = `db/${srcEnv}/${this.getDBName(srcEnv)}/${ddlType}`;
        const destFolder = `db/${destEnv}/${this.getDBName(destEnv)}/${ddlType}`;
        srcContent = this.fileManager.readFromFile(srcFolder, `${ddlName}.sql`);
        destContent = this.fileManager.readFromFile(destFolder, `${ddlName}.sql`);
      }

      if (!srcContent || !destContent) return false;

      const cleanSrc = srcContent.replace(this.domainNormalization.pattern, this.domainNormalization.replacement);
      const cleanDest = destContent.replace(this.domainNormalization.pattern, this.domainNormalization.replacement);

      if (cleanSrc !== cleanDest) {
        if (global.logger) {
          global.logger.info('=======================================');
          this.logDiff(cleanSrc, cleanDest);
          global.logger.info('=======================================');
        }
        this.vimDiffToHtml(destEnv, ddlType, ddlName, `${srcEnv}/${this.getDBName(srcEnv)}/${ddlType}`, `${destEnv}/${this.getDBName(destEnv)}/${ddlType}`, `${ddlName}.sql`);
        return true;
      }
      return false;
    }
  }

  async reportDLLChange(srcEnv, ddlType, destEnv = null) {
    try {
      destEnv = this.getDestinationEnvironment(srcEnv, destEnv);
      if (destEnv === srcEnv) return;

      const mapMigrateFolder = this.setupMigrationFolder(srcEnv, destEnv);
      const { srcLines, destLines } = await this.loadDDLContent(srcEnv, destEnv, ddlType);

      if (!srcLines.length) return;

      if (global.logger) global.logger.info('Comparing...', srcLines.length, '->', destLines.length, ddlType);

      if (ddlType === TRIGGERS) {
        await this.handleTriggerComparison(srcEnv, destEnv, mapMigrateFolder);
      }

      const newDDL = await this.processNewDDL(mapMigrateFolder, srcLines, destLines, ddlType, destEnv);
      const updatedDDL = await this.processUpdatedDDL(mapMigrateFolder, srcLines, destLines, ddlType, srcEnv, destEnv);
      const deprecatedDDL = await this.processDeprecatedDDL(mapMigrateFolder, srcLines, destLines, ddlType);

      // Log detailed comparison results
      if (global.logger) {
        const newCount = newDDL[`${ddlType}_new`] || 0;
        const updatedCount = updatedDDL[`${ddlType}_updated`] || 0;
        const deprecatedCount = deprecatedDDL[`${ddlType}_deprecated`] || 0;
        const totalChanges = newCount + updatedCount + deprecatedCount;

        global.logger.info(`\n📊 Comparison Results for ${ddlType}:`);
        global.logger.info(`  ✨ New: ${newCount}`);
        global.logger.info(`  🔄 Updated: ${updatedCount}`);
        global.logger.info(`  ⚠️  Deprecated: ${deprecatedCount}`);
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

  async reportTriggerChange(srcEnv, destEnv = null) {
    try {
      destEnv = this.getDestinationEnvironment(srcEnv, destEnv);
      if (destEnv === srcEnv) return;

      const mapMigrateFolder = this.setupMigrationFolder(srcEnv, destEnv);
      const { srcLines, destLines } = await this.loadDDLContent(srcEnv, destEnv, TRIGGERS);

      if (global.logger) global.logger.info('Comparing triggers...', srcLines.length, '->', destLines.length);

      await this.handleTriggerComparison(srcEnv, destEnv, mapMigrateFolder);

      const newTriggers = await this.processNewDDL(mapMigrateFolder, srcLines, destLines, 'triggers', destEnv);
      const updatedTriggers = await this.processUpdatedDDL(mapMigrateFolder, srcLines, destLines, 'triggers', srcEnv, destEnv);
      const deprecatedTriggers = await this.processDeprecatedDDL(mapMigrateFolder, srcLines, destLines, 'triggers');

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

  async loadDDLContent(srcEnv, destEnv, ddlType) {
    if (this.storage) {
      const srcLines = await this.storage.getDDLList(srcEnv, this.getDBName(srcEnv), ddlType);
      const destLines = await this.storage.getDDLList(destEnv, this.getDBName(destEnv), ddlType);
      return { srcLines: srcLines.sort(), destLines: destLines.sort() };
    }

    const srcContent = this.fileManager.readFromFile(`db/${srcEnv}/${this.getDBName(srcEnv)}/current-ddl`, `${ddlType}.list`);
    const destContent = this.fileManager.readFromFile(`db/${destEnv}/${this.getDBName(destEnv)}/current-ddl`, `${ddlType}.list`);
    const srcLines = srcContent ? srcContent.split('\n').map(line => line.trim()).filter(l => l).sort() : [];
    const destLines = destContent ? destContent.split('\n').map(line => line.trim()).filter(l => l).sort() : [];

    return { srcLines, destLines };
  }

  async handleTriggerComparison(srcEnv, destEnv, mapMigrateFolder) {
    const { srcLines, destLines } = await this.loadDDLContent(srcEnv, destEnv, TRIGGERS);
    const srcTriggers = await this.parseTriggerList(srcEnv, srcLines);
    const destTriggers = await this.parseTriggerList(destEnv, destLines);
    const triggerChanges = this.compareTriggerLists(srcTriggers, destTriggers);

    if (triggerChanges.length > 0) {
      this.saveTriggerChanges(mapMigrateFolder, triggerChanges);
    }
  }

  async parseTriggerList(env, lines) {
    const list = [];
    for (const line of lines) {
      let content;
      if (this.storage) {
        content = await this.storage.getDDL(env, this.getDBName(env), TRIGGERS, line);
      } else {
        content = this.fileManager.readFromFile(`db/${env}/${this.getDBName(env)}/triggers`, `${line}.sql`);
      }
      const parsed = this.parseTriggerDefinition(content);
      if (parsed) list.push(parsed);
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

  async processNewDDL(mapMigrateFolder, srcLines, destLines, ddlType, destEnv) {
    return await this.markNewDDL(`${mapMigrateFolder}/${ddlType}`, srcLines, destLines, ddlType, destEnv);
  }

  async processUpdatedDDL(mapMigrateFolder, srcLines, destLines, ddlType, srcEnv, destEnv) {
    return await this.markChangeDDL(`${mapMigrateFolder}/${ddlType}`, srcLines, destLines, ddlType, srcEnv, destEnv);
  }

  async processDeprecatedDDL(mapMigrateFolder, srcLines, destLines, ddlType) {
    return await this.markDeprecatedDDL(`${mapMigrateFolder}/${ddlType}`, srcLines, destLines, ddlType);
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

  compare(ddl) {
    return async (env) => {
      if (global.logger) global.logger.warn(`Start comparing ${ddl} changes for...`, env);
      const srcEnv = this.getSourceEnv(env);
      switch (ddl) {
        case FUNCTIONS:
          await this.reportDLLChange(srcEnv, FUNCTIONS, env);
          break;
        case PROCEDURES:
          await this.reportDLLChange(srcEnv, PROCEDURES, env);
          break;
        case TABLES:
          await this.reportDLLChange(srcEnv, TABLES, env);
          await this.reportTableStructureChange(env);
          break;
        case TRIGGERS:
          await this.reportTriggerChange(srcEnv, env);
          break;
        default:
          this.report2console(env);
          break;
      }
    };
  }
}