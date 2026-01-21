const fs = require('fs');
const path = require('path');
const {
  STATUSES: { NEW, UPDATED, DEPRECATED },
  DDL: { TABLES, PROCEDURES, FUNCTIONS }
} = require('../configs/constants');
const { spawn } = require('child_process');

class ReportHelper {
  constructor({ getSourceEnv, getDBName, fileManager, reportDir = 'reports' }) {
    this.getSourceEnv = getSourceEnv;
    this.getDBName = getDBName;
    this.fileManager = fileManager;
    this.reportDir = reportDir;
  }

  vimDiffToHtml(destEnv, ddlType, ddlName, folder1, folder2, fname) {
    this.fileManager.makeSureFolderExisted(`${this.reportDir}/diff/${destEnv}/${this.getDBName(destEnv)}/${ddlType}`);
    const reportPath = `${this.reportDir}/diff/${destEnv}/${this.getDBName(destEnv)}/${ddlType}`;
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
    const folder = `${this.reportDir}/json`;
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
    const report = this.fileManager.readFromFile(`${this.reportDir}/json`, `${this.getDBName(destEnv)}.${destEnv}.json`);
    console.info(`\n████▓▓▓▓▒▒▒▒░░░░ REPORT: ${this.getSourceEnv(destEnv)} to ${destEnv} ░░░░▒▒▒▒▓▓▓▓████\n${report.replace(/["{},\[\]]/g, '')}\n████▓▓▓▓▒▒▒▒░░░░ REPORT: ${this.getSourceEnv(destEnv)} to ${destEnv} ░░░░▒▒▒▒▓▓▓▓████`);
  }

  async report2html(destEnv) {
    const {
      DDL: { TABLES, PROCEDURES, FUNCTIONS, VIEWS, TRIGGERS, EVENTS },
      STATUSES: { NEW, UPDATED, DEPRECATED }
    } = require('../configs/constants');

    // 1. read template
    const template = this.fileManager.readFromFile('src/reports/html', 'template.html');
    // 2. read report
    const report = this.fileManager.readFromFile(`${this.reportDir}/json`, `${this.getDBName(destEnv)}.${destEnv}.json`);
    const rr = revertAndJoin(report);

    // All DDL types and their human-readable labels
    const categories = [
      { id: TABLES, label: 'Tables' },
      { id: VIEWS, label: 'Views' },
      { id: PROCEDURES, label: 'Procedures' },
      { id: FUNCTIONS, label: 'Functions' },
      { id: TRIGGERS, label: 'Triggers' },
      { id: EVENTS, label: 'Events' }
    ];

    const chartCategories = categories.map(c => c.label);
    const TOTAL_DDL = categories.map(c => rr[`${c.id.toLowerCase()}_total`] || 0);
    const NEW_DDL = categories.map(c => rr[`${c.id.toLowerCase()}_new`] || 0);
    const UPDATED_DDL = categories.map(c => {
      if (c.id === TABLES) {
        // For tables, updated can be columns or indexes
        return rr[`tables_updated`] || 0;
      }
      return rr[`${c.id.toLowerCase()}_updated`] || 0;
    });
    const DEPRECATED_DDL = categories.map(c => rr[`${c.id.toLowerCase()}_deprecated`] || 0);

    const srcEnv = this.getSourceEnv(destEnv);
    const folderMap = `/map-migrate/${srcEnv}-to-${destEnv}/${this.getDBName(srcEnv)}`;

    const replacements = {
      '{{ENV}}': `${srcEnv} → ${destEnv}`,
      '{{CHART_CATEGORIES}}': JSON.stringify(chartCategories),
      '{{TOTAL_DDL}}': JSON.stringify(TOTAL_DDL),
      '{{NEW_DDL}}': JSON.stringify(NEW_DDL),
      '{{UPDATED_DDL}}': JSON.stringify(UPDATED_DDL),
      '{{DEPRECATED_DDL}}': JSON.stringify(DEPRECATED_DDL),
      '{{MISSING_COLUMNS}}': JSON.stringify(rr.columns_missing || {}, null, 2),
      '{{STYLE4MISSING}}': (rr.columns_missing && Object.keys(rr.columns_missing).length > 0) ? '' : 'display:none'
    };

    // Auto-generate DDL list replacements
    [TABLES, VIEWS, PROCEDURES, FUNCTIONS, TRIGGERS, EVENTS].forEach(type => {
      const typeLower = type.toLowerCase().replace(/s$/, ''); // singular for folder if needed, but constants use plural
      const typePath = `${folderMap}/${type}`;

      replacements[`{{${type.replace(/S$/, '')}_NEW}}`] = this.genDDLItem(typePath, NEW);
      replacements[`{{${type.replace(/S$/, '')}_UPDATE}}`] = this.genDDLItem(typePath, UPDATED, type, destEnv);
      replacements[`{{${type.replace(/S$/, '')}_DEPRECATED}}`] = this.genDDLItem(typePath, DEPRECATED);
    });

    let reportHTML = template;
    for (const [key, value] of Object.entries(replacements)) {
      // Use split/join for global replace if needed, or regex
      reportHTML = reportHTML.split(key).join(value);
    }

    this.fileManager.saveToFile(this.reportDir, `${this.getDBName(destEnv)}.${destEnv}.html`, reportHTML);
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