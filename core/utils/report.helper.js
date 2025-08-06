const fs = require('fs');
const path = require('path');
const { 
  STATUSES: { NEW, UPDATED, DEPRECATED },
  DDL: { TABLES, PROCEDURES, FUNCTIONS }
} = require('../configs/constants');
const { spawn } = require('child_process');

class ReportHelper {
  constructor({ getSourceEnv, getDBName, fileManager }) {
    this.getSourceEnv = getSourceEnv;
    this.getDBName = getDBName;
    this.fileManager = fileManager;
  }

  vimDiffToHtml(destEnv, ddlType, ddlName, folder1, folder2, fname) {
    this.fileManager.makeSureFolderExisted(`reports/diff/${destEnv}/${this.getDBName(destEnv)}/${ddlType}`);
    const reportPath = `reports/diff/${destEnv}/${this.getDBName(destEnv)}/${ddlType}`;
    const outputFilename = path.join(reportPath, `${ddlName}.html`);

    const vimProcess = spawn('vimdiff', [
      '-n',
      '-c', 'TOhtml',
      '-c', `wq! ${outputFilename}`,
      '-c', 'qa!',
      path.join(folder1, fname),
      path.join(folder2, fname)
    ]);

    vimProcess.on('error', (error) => {
      console.error(`Error: ${error.message}`);
    });

    vimProcess.on('close', (code) => {
      if (code > 0) {
        console.error(`Vimdiff process exited with code ${code}`);
      }
    });
  }

  appendReport(env, newReport) {
    const folder = 'reports/json';
    const fileName = `${this.getDBName(env)}.${env}.json`;
    // 1. read
    const oldReport = this.fileManager.readFromFile(folder, fileName);
    // 2. array to object
    const reports = revertAndJoin(oldReport);
    // 3. merge
    const finalReport = { ...reports };
    // 4. merge new
    Object.assign(finalReport, newReport);
    const splitConvert = splitAndConvert({ ...finalReport, ...newReport });
    // 5. append & write
    this.fileManager.saveToFile(folder, fileName, JSON.stringify(splitConvert, null, 2));
  }

  report2console(destEnv) {
    const report = this.fileManager.readFromFile(`reports/json`, `${this.getDBName(destEnv)}.${destEnv}.json`);
    console.info(`\n████▓▓▓▓▒▒▒▒░░░░ REPORT: ${this.getSourceEnv(destEnv)} to ${destEnv} ░░░░▒▒▒▒▓▓▓▓████\n${report.replace(/["{},\[\]]/g, '')}\n████▓▓▓▓▒▒▒▒░░░░ REPORT: ${this.getSourceEnv(destEnv)} to ${destEnv} ░░░░▒▒▒▒▓▓▓▓████`);
  }

  async report2html(destEnv) {
    // 1. read template
    const template = this.fileManager.readFromFile('reports/html', 'template.html');
    // 2. read report
    const report = this.fileManager.readFromFile('reports/json', `${this.getDBName(destEnv)}.${destEnv}.json`);
    const rr = revertAndJoin(report);
    // order by F P T
    const TOTAL_DDL = JSON.stringify([
      rr.functions_total || 0,
      rr.procedures_total || 0,
      rr.tables_total || 0,
      '-',
      '-'
    ]);
    const NEW_DDL = JSON.stringify([
      rr.functions_new || 0,
      rr.procedures_new || 0,
      rr.tables_new || 0,
      '-',
      '-'
    ]);
    const UPDATED_DDL = JSON.stringify([
      rr.functions_updated || 0,
      rr.procedures_updated || 0,
      rr.tables_updated || 0,
      rr.indexes_updated || 0,
      rr.columns_updated || 0,
    ]);
    const DEPRECATED_DDL = JSON.stringify([
      rr.functions_deprecated || 0,
      rr.procedures_deprecated || 0,
      rr.tables_deprecated || 0,
      '-',
      '-'
    ]);
    const srcEnv = this.getSourceEnv(destEnv);
    const folderMap = `/map-migrate/${srcEnv}-to-${destEnv}/${this.getDBName(srcEnv)}`;
    const tablePath = `${folderMap}/${TABLES}`;
    const procedurePath = `${folderMap}/${PROCEDURES}`;
    const functionPath = `${folderMap}/${FUNCTIONS}`;
    const TABLE_NEW = this.genDDLItem(tablePath, NEW);
    const TABLE_UPDATE = this.genDDLItem(tablePath, UPDATED);
    const TABLE_DEPRECATED = this.genDDLItem(tablePath, DEPRECATED);
    const PROCEDURE_NEW = this.genDDLItem(procedurePath, NEW);
    const PROCEDURE_DEPRECATED = this.genDDLItem(procedurePath, DEPRECATED);
    const PROCEDURE_UPDATE = this.genDDLItem(procedurePath, UPDATED, PROCEDURES, destEnv);
    const FUNCTION_NEW = this.genDDLItem(functionPath, NEW);
    const FUNCTION_DEPRECATED = this.genDDLItem(functionPath, DEPRECATED);
    const FUNCTION_UPDATE = this.genDDLItem(functionPath, UPDATED, FUNCTIONS, destEnv);
    const MISSING_COLUMNS = JSON.stringify(rr.columns_missing || '{}', null, 2).replace(/"\,\{\}/g, '');
    // 3. write down report
    const reportHTML = template
      .replace(/{{ENV}}/g, `${this.getSourceEnv(destEnv)} with ${destEnv}`)
      .replace(/{{TOTAL_DDL}}/, TOTAL_DDL)
      .replace(/{{NEW_DDL}}/, NEW_DDL)
      .replace(/{{UPDATED_DDL}}/, UPDATED_DDL)
      .replace(/{{DEPRECATED_DDL}}/, DEPRECATED_DDL)
      .replace(/{{MISSING_COLUMNS}}/, MISSING_COLUMNS)
      .replace(/{{STYLE4MISSING}}/, MISSING_COLUMNS === '{}' ? 'display:none' : '')
      .replace(/{{TABLE_NEW}}/, TABLE_NEW)
      .replace(/{{TABLE_UPDATE}}/, TABLE_UPDATE)
      .replace(/{{TABLE_DEPRECATED}}/, TABLE_DEPRECATED)
      .replace(/{{PROCEDURE_NEW}}/, PROCEDURE_NEW)
      .replace(/{{PROCEDURE_UPDATE}}/, PROCEDURE_UPDATE)
      .replace(/{{PROCEDURE_DEPRECATED}}/, PROCEDURE_DEPRECATED)
      .replace(/{{FUNCTION_NEW}}/, FUNCTION_NEW)
      .replace(/{{FUNCTION_UPDATE}}/, FUNCTION_UPDATE)
      .replace(/{{FUNCTION_DEPRECATED}}/, FUNCTION_DEPRECATED)
    this.fileManager.saveToFile(`reports`, `${this.getDBName(destEnv)}.${destEnv}.html`, reportHTML);
  }

  genDDLItem(ddlPath, status, ddlType, destEnv = null) {
    const ddlList = this.fileManager.readFromFile(ddlPath, `${status}.list`)?.split('\n') || [];
    if (!ddlList.length) {
      return `<li>None</li>`;
    }
    if (destEnv) {
      return ddlList.map((ddl) => (`<li><a href="/reports/diff/${destEnv}/${this.getDBName(destEnv)}/${ddlType}/${ddl}.html">${ddl}</a></li>`)).join('\n');
    }
    return ddlList.map((ddl) => (`<li>${ddl}</li>`)).join('\n');
  }
}

function splitAndConvert(inputObj, separator = '_') {
  const resultObj = {};
  for (const propName in inputObj) {
    if (inputObj.hasOwnProperty(propName)) {
      const propParts = propName.split(separator);
      if (propParts.length === 2) {
        const parentKey = propParts[0];
        const childKey = propParts[1];
        if (!resultObj[parentKey]) {
          resultObj[parentKey] = {};
        }
        resultObj[parentKey][childKey] = inputObj[propName];
      } else {
        resultObj[propName] = inputObj[propName];
      }
    }
  }
  return resultObj;
}

function revertAndJoin(inputObj, separator = '_') {
  if ('string' === typeof inputObj) {
    if (inputObj.length === '{}'.length) { return {}; }
    try {
      inputObj = JSON.parse(inputObj);
    } catch (error) {
      inputObj = {};
    }
  }
  const resultObj = {};
  for (const parentKey in inputObj) {
    if (!inputObj.hasOwnProperty(parentKey)) {
      resultObj[parentKey] = inputObj[parentKey];
      continue;
    }
    const childObj = inputObj[parentKey];
    for (const childKey in childObj) {
      if (!childObj.hasOwnProperty(childKey)) {
        continue;
      }
      const propName = `${parentKey}${separator}${childKey}`;
      resultObj[propName] = childObj[childKey];
    }
  }
  return resultObj;
}

const createReportHelper = (deps) => new ReportHelper(deps);

module.exports = { ReportHelper, createReportHelper };