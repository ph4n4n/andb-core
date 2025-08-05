const fs = require('fs');
const path = require('path');
// Remove direct import of file helper
// const { saveToFile, makeSureFolderExisted, emptyDirectory, readFromFile } = require('../utils/file.helper');
const { getDestEnv,
  DDL: { FUNCTIONS, PROCEDURES, TABLES, TRIGGERS } } = require('../configs/constants');

const { diffWords } = require('diff');

module.exports = class ComparatorService {
  constructor(dependencies) {
    for (const key in dependencies) {
      this[key] = dependencies[key];
    }
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
        alog.error('Error parsing table name');
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
            alog.error('Error parsing column name');
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
      alog.error('Error parsing table definition:', error);
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
      const triggerNameLine = lines.find(line => line.includes('CREATE TRIGGER'));
      const triggerNameMatch = triggerNameLine?.match(/`([^`]+)`/);

      if (!triggerNameMatch || triggerNameMatch.length < 2) {
        alog.error('Error parsing trigger name');
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
      alog.error('Error parsing trigger definition:', error);
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
    // 1. Compare primary keys NOT allowed
    // if (srcTableDefinition.primaryKey.join(',') !== destTableDefinition.primaryKey.join(',')) {
    //    alterSQL.push(`DROP PRIMARY KEY, ADD PRIMARY KEY (${srcTableDefinition.primaryKey.join(',')})`);
    // }
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
    const removeBTREE = (idx) => idx.replace(/\s?(,|USING BTREE)/g, '').trim();

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
      alog.info(`📋 Found ${alterColumnsList.length} tables with column changes`);
      alog.info(`📋 Found ${alterIndexesList.length} tables with index changes`);

      if (alterColumnsList.length > 0) {
        alog.info(`📋 Tables with column changes: ${alterColumnsList.join(', ')}`);
      }
      if (alterIndexesList.length > 0) {
        alog.info(`📋 Tables with index changes: ${alterIndexesList.join(', ')}`);
      }

      // Log detailed changes for each table
      for (const tableName of alterColumnsList) {
        const alterSQL = this.checkDiffAndGenAlter(tableName, env);
        if (alterSQL.columns) {
          alog.info(`📋 Column changes for ${tableName}: ${alterSQL.columns}`);
        }
      }

      for (const tableName of alterIndexesList) {
        const alterSQL = this.checkDiffAndGenAlter(tableName, env);
        if (alterSQL.indexes) {
          alog.info(`📋 Index changes for ${tableName}: ${alterSQL.indexes}`);
        }
      }

    } catch (error) {
      alog.error('Error in reportTableStructureChange:', error);
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
    const fTable = path.join(`map-migrate`, `${this.getSourceEnv(env)}-to-${env}`, `${this.getDBName(this.getSourceEnv(env))}`, `tables`);
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
    const newDDL = `new.list`;
    this.fileManager.saveToFile(reportDDLFolder, newDDL, '');
    const newLines = srcLines
      .filter(line => !destLines.includes(line)).filter(Boolean);
    this.fileManager.makeSureFolderExisted(reportDDLFolder);
    this.fileManager.emptyDirectory(`reports/diff/${destEnv}/${this.getDBName(destEnv)}/${ddlType}`);

    if (newLines.length > 0) {
      const result = newLines.sort().join('\n');
      this.fileManager.saveToFile(reportDDLFolder, newDDL, result);
    }

    // Special handling for OTE procedures and functions
    if (ddlType in [PROCEDURES, FUNCTIONS]) {
      const oteDDL = `ote.list`;
      const oteLines = newLines.filter(line => line.indexOf('OTE_') > -1);
      if (oteLines.length > 0) {
        const oteResult = oteLines.sort().join('\n');
        this.fileManager.saveToFile(reportDDLFolder, oteDDL, oteResult);
      }
      // add to report
      return {
        [`${ddlType}_new`]: newLines.length,
        [`${ddlType}_ote`]: oteLines.length
      };
    }

    // add to report
    return { [`${ddlType}_new`]: newLines.length };
  }

  async markDeprecatedDDL(reportDDLFolder, srcLines, destLines, ddlType) {
    const deprecatedDDL = `deprecated.list`;
    this.fileManager.saveToFile(reportDDLFolder, deprecatedDDL, '');

    const deprecatedLines = destLines.filter(
      line => !srcLines.includes(line)
    );
    this.fileManager.makeSureFolderExisted(reportDDLFolder);

    if (deprecatedLines.length > 0) {
      const result = deprecatedLines.sort().join('\n');
      this.fileManager.saveToFile(reportDDLFolder, deprecatedDDL, result);
    }
    // add to report
    return { [`${ddlType}_deprecated`]: deprecatedLines.length };
  }

  async markChangeDDL(reportDDLFolder, srcLines, destLines, ddlType, srcEnv, destEnv) {
    const updatedDDL = `updated.list`;
    this.fileManager.saveToFile(reportDDLFolder, updatedDDL, '');

    const existedDDL = srcLines.filter(line => destLines.includes(line));
    this.fileManager.makeSureFolderExisted(reportDDLFolder);
    this.fileManager.emptyDirectory(`reports/diff/${destEnv}/${this.getDBName(destEnv)}/${ddlType}`);

    // source
    const currentLines = this.fileManager.readFromFile(reportDDLFolder, updatedDDL, 1);
    const updatedLines = existedDDL.filter(this.findDDLChanged2igrate(srcEnv, ddlType, destEnv));

    if (updatedLines.length > 0) {
      const result = [...currentLines, ...updatedLines].sort().join('\n');
      this.fileManager.saveToFile(reportDDLFolder, updatedDDL, result);

      // Special handling for tables - generate ALTER files
      if (ddlType === TABLES) {
        await this.generateTableAlterFiles(updatedLines, srcEnv, destEnv, reportDDLFolder);
      }
    }

    // add to report
    return { [`${ddlType}_updated`]: updatedLines.length };
  }

  async generateTableAlterFiles(updatedTables, srcEnv, destEnv, reportDDLFolder) {
    const alterColumnsList = [];
    const alterIndexesList = [];
    const alterColumnsChanges = {};
    const alterIndexesChanges = {};

    for (const tableName of updatedTables) {
      const alterResult = this.checkDiffAndGenAlter(tableName, destEnv);

      if (alterResult.columns && alterResult.columns.length > 0) {
        alterColumnsList.push(tableName);
        alterColumnsChanges[tableName] = alterResult.columns;
        this.writeAlter(destEnv, tableName, 'columns', alterResult.columns);
      }

      if (alterResult.indexes && alterResult.indexes.length > 0) {
        alterIndexesList.push(tableName);
        alterIndexesChanges[tableName] = alterResult.indexes;
        this.writeAlter(destEnv, tableName, 'indexes', alterResult.indexes);
      }
    }

    // Update alter lists
    if (alterColumnsList.length > 0) {
      this.fileManager.saveToFile(reportDDLFolder, 'alter-columns.list', alterColumnsList.join('\n'));
    }

    if (alterIndexesList.length > 0) {
      this.fileManager.saveToFile(reportDDLFolder, 'alter-indexes.list', alterIndexesList.join('\n'));
    }
  }

  findDDLChanged2igrate(srcEnv, ddlType, destEnv) {
    return ddlName => {
      const srcFolder = `db/${srcEnv}/${this.getDBName(srcEnv)}/${ddlType}`;
      const destFolder = `db/${destEnv}/${this.getDBName(destEnv)}/${ddlType}`;
      // 1. get content current ddl ready to compare
      const _domainRegex = /@flo(dev\.net|uat\.net|stage\.com)/g;
      const srcContent = this.fileManager.readFromFile(srcFolder, `${ddlName}.sql`)
        .replace(_domainRegex, '@flomail.net');
      const destContent = this.fileManager.readFromFile(destFolder, `${ddlName}.sql`)
        .replace(_domainRegex, '@flomail.net');
      if (!srcContent || !destContent) {
        return false;
      }
      if (srcContent !== destContent) {
        // diff content compare
        // vimDiffToHtml(destEnv, ddlType, ddlName, srcFolder, destFolder, `${ddlName}.sql`);
        return srcContent !== destContent;
      }
    }
  }

  async reportDLLChange(srcEnv, ddlType, destEnv = null) {
    try {
      destEnv = this.getDestinationEnvironment(srcEnv, destEnv);
      if (destEnv === srcEnv) return;

      const mapMigrateFolder = this.setupMigrationFolder(srcEnv, destEnv);
      const { srcLines, destLines } = await this.loadDDLContent(srcEnv, destEnv, ddlType);

      if (!srcLines.length) return;

      alog.info('Comparing...', srcLines.length, '->', destLines.length, ddlType);

      // Handle triggers specially
      if (ddlType === TRIGGERS) {
        await this.handleTriggerComparison(srcEnv, destEnv, mapMigrateFolder);
      }

      // Process DDL changes
      const newDDL = await this.processNewDDL(mapMigrateFolder, srcLines, destLines, ddlType, destEnv);
      const updatedDDL = await this.processUpdatedDDL(mapMigrateFolder, srcLines, destLines, ddlType, srcEnv, destEnv);
      const deprecatedDDL = await this.processDeprecatedDDL(mapMigrateFolder, srcLines, destLines, ddlType);

      // Generate reports
      await this.generateReports(destEnv, { ...newDDL, ...deprecatedDDL, ...updatedDDL });
    } catch (error) {
      alog.error('Error in reportDLLChange:', error);
    }
  }

  async reportTriggerChange(srcEnv, destEnv = null) {
    try {
      destEnv = this.getDestinationEnvironment(srcEnv, destEnv);
      if (destEnv === srcEnv) return;

      const mapMigrateFolder = this.setupMigrationFolder(srcEnv, destEnv);

      // Load trigger content specifically
      const { srcLines, destLines } = await this.loadDDLContent(srcEnv, destEnv, TRIGGERS);

      alog.info('Comparing triggers...', srcLines.length, '->', destLines.length);

      // Handle trigger comparison
      await this.handleTriggerComparison(srcEnv, destEnv, mapMigrateFolder);

      // Process trigger changes (new, updated, deprecated)
      const newTriggers = await this.processNewDDL(mapMigrateFolder, srcLines, destLines, 'triggers', destEnv);
      const updatedTriggers = await this.processUpdatedDDL(mapMigrateFolder, srcLines, destLines, 'triggers', srcEnv, destEnv);
      const deprecatedTriggers = await this.processDeprecatedDDL(mapMigrateFolder, srcLines, destLines, 'triggers');

      // Generate reports
      await this.generateReports(destEnv, { ...newTriggers, ...deprecatedTriggers, ...updatedTriggers });
    } catch (error) {
      alog.error('Error in reportTriggerChange:', error);
    }
  }

  getDestinationEnvironment(srcEnv, destEnv) {
    if (!destEnv) {
      destEnv = getDestEnv(srcEnv);
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
    const srcContent = this.fileManager.readFromFile(`db/${srcEnv}/${this.getDBName(srcEnv)}/current-ddl`, `${ddlType}.list`);
    const destContent = this.fileManager.readFromFile(`db/${destEnv}/${this.getDBName(destEnv)}/current-ddl`, `${ddlType}.list`);

    const srcLines = srcContent ? srcContent.split('\n').map(line => line.trim()).sort() : [];
    const destLines = destContent ? destContent.split('\n').map(line => line.trim()).sort() : [];

    return { srcLines, destLines };
  }

  async handleTriggerComparison(srcEnv, destEnv, mapMigrateFolder) {
    const srcLines = this.fileManager.readFromFile(`db/${srcEnv}/${this.getDBName(srcEnv)}/current-ddl`, `triggers.list`)
      .split('\n').map(line => line.trim()).sort();
    const destLines = this.fileManager.readFromFile(`db/${destEnv}/${this.getDBName(destEnv)}/current-ddl`, `triggers.list`)
      .split('\n').map(line => line.trim()).sort();

    const srcTriggers = this.parseTriggerList(srcEnv, srcLines);
    const destTriggers = this.parseTriggerList(destEnv, destLines);
    const triggerChanges = this.compareTriggerLists(srcTriggers, destTriggers);

    if (triggerChanges.length > 0) {
      this.saveTriggerChanges(mapMigrateFolder, triggerChanges);
    }
  }

  parseTriggerList(env, lines) {
    return lines.map(line => {
      const content = this.fileManager.readFromFile(`db/${env}/${this.getDBName(env)}/triggers`, `${line}.sql`);
      return this.parseTriggerDefinition(content);
    }).filter(Boolean);
  }

  compareTriggerLists(srcTriggers, destTriggers) {
    const triggerChanges = [];
    const duplicateWarnings = [];

    // Check for duplicate triggers in source
    const srcDuplicates = this.findDuplicateTriggers(srcTriggers);
    if (srcDuplicates.length > 0) {
      duplicateWarnings.push({
        type: 'source_duplicates',
        duplicates: srcDuplicates
      });
    }

    // Check for duplicate triggers in destination
    const destDuplicates = this.findDuplicateTriggers(destTriggers);
    if (destDuplicates.length > 0) {
      duplicateWarnings.push({
        type: 'destination_duplicates',
        duplicates: destDuplicates
      });
    }

    // Compare triggers
    for (const srcTrigger of srcTriggers) {
      const destTrigger = destTriggers.find(t => t.triggerName === srcTrigger.triggerName);
      const comparison = this.compareTriggers(srcTrigger, destTrigger);

      if (comparison?.hasChanges) {
        triggerChanges.push({
          triggerName: srcTrigger.triggerName,
          changes: comparison.differences
        });
      }
    }

    // Log warnings if any
    if (duplicateWarnings.length > 0) {
      this.logDuplicateTriggerWarnings(duplicateWarnings);
    }

    return triggerChanges;
  }

  findDuplicateTriggers(triggers) {
    const duplicates = [];
    const triggerGroups = {};

    // Group triggers by table, event, and timing
    for (const trigger of triggers) {
      const key = `${trigger.tableName}_${trigger.event}_${trigger.timing}`;
      if (!triggerGroups[key]) {
        triggerGroups[key] = [];
      }
      triggerGroups[key].push(trigger);
    }

    // Find groups with multiple triggers
    for (const [key, triggerList] of Object.entries(triggerGroups)) {
      if (triggerList.length > 1) {
        const [tableName, event, timing] = key.split('_');
        duplicates.push({
          tableName,
          event,
          timing,
          triggers: triggerList.map(t => t.triggerName),
          count: triggerList.length
        });
      }
    }

    return duplicates;
  }

  logDuplicateTriggerWarnings(warnings) {
    for (const warning of warnings) {
      const envType = warning.type === 'source_duplicates' ? 'SOURCE' : 'DESTINATION';
      alog.warn(`⚠️  DUPLICATE TRIGGERS FOUND in ${envType} environment:`);

      for (const duplicate of warning.duplicates) {
        alog.warn(`   Table: ${duplicate.tableName}`);
        alog.warn(`   Event: ${duplicate.event} ${duplicate.timing}`);
        alog.warn(`   Triggers (${duplicate.count}): ${duplicate.triggers.join(', ')}`);
        alog.warn(`   ⚠️  Multiple triggers for same event may cause conflicts!`);
        alog.warn('');
      }
    }
  }

  saveTriggerChanges(mapMigrateFolder, triggerChanges) {
    const reportFolder = `${mapMigrateFolder}/triggers`;
    this.fileManager.makeSureFolderExisted(reportFolder);
    this.fileManager.saveToFile(reportFolder, 'trigger-changes.json', JSON.stringify(triggerChanges, null, 2));
    alog.info('Trigger changes found:', triggerChanges.length);
  }

  async processNewDDL(mapMigrateFolder, srcLines, destLines, ddlType, destEnv) {
    const newDDL = await this.markNewDDL(`${mapMigrateFolder}/${ddlType}`, srcLines, destLines, ddlType, destEnv);
    if (newDDL) {
      this.logNewDDLStats(newDDL, ddlType);
    }
    return newDDL;
  }

  logNewDDLStats(newDDL, ddlType) {
    alog.info('New..........', Object.entries(newDDL)
      .filter(([k]) => k.includes('_new'))
      .reduce((total, [k, v]) => total + v, 0));

    if (ddlType in [PROCEDURES, FUNCTIONS]) {
      alog.info('OTE..........', Object.entries(newDDL)
        .filter(([k]) => k.includes('_ote'))
        .reduce((total, [k, v]) => total + v, 0));
    }
  }

  async processUpdatedDDL(mapMigrateFolder, srcLines, destLines, ddlType, srcEnv, destEnv) {
    const updatedDDL = await this.markChangeDDL(`${mapMigrateFolder}/${ddlType}`, srcLines, destLines, ddlType, srcEnv, destEnv);
    if (updatedDDL) {
      alog.info('Updated......', Object.values(updatedDDL).reduce((total, n) => total + n, 0));
    }
    return updatedDDL;
  }

  async processDeprecatedDDL(mapMigrateFolder, srcLines, destLines, ddlType) {
    const deprecatedDDL = await this.markDeprecatedDDL(`${mapMigrateFolder}/${ddlType}`, srcLines, destLines, ddlType);
    if (deprecatedDDL) {
      alog.info('Deprecated...', Object.values(deprecatedDDL).reduce((total, n) => total + n, 0));
    }
    return deprecatedDDL;
  }

  async generateReports(destEnv, allChanges) {
    await this.appendReport(destEnv, allChanges);
    await this.report2html(destEnv);
  }

  async logDiff(srcColumnDef, destColumnDef) {
    console.time('---------------------------------------', srcColumnDef);
    console.log('S:', srcColumnDef);
    console.log('D:', destColumnDef);
    console.log('Diff:');

    const differences = diffWords(srcColumnDef, destColumnDef); // Use diffJson if objects
    differences.forEach(part => {
      const color = part.added ? '\x1b[32m' : part.removed ? '\x1b[31m' : '\x1b[0m';
      process.stdout.write(color + part.value + '\x1b[0m');
    });
    console.timeEnd('---------------------------------------', srcColumnDef);
  }

  /**
   * Compare function that compares the specified DDL between environments
   * 
   * @param {string} ddl - The type of DDL to compare (e.g., TABLES, FUNCTIONS, PROCEDURES).
   * @returns {Function} - An async function that takes an environment object and compares the DDL.
   */
  compare(ddl) {
    return async (env) => {
      alog.warn(`Start comparing ${ddl} changes for...`, env);
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
          // Note: report2console needs to be injected
          this.report2console(env);
          break;
      }
    };
  }
}