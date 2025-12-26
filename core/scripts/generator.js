const fs = require('fs');
const path = require('path');

// Dynamic environment configuration
function getDynamicEnvironments() {
  // Priority: CLI options > CLI context > Default
  const envEnvironments = process.env.ANDB_ENVIRONMENTS;
  if (envEnvironments) {
    return envEnvironments.split(',').map(env => env.trim().toUpperCase());
  }

  if (global.ANDB_CONTEXT && global.ANDB_CONTEXT.ENVIRONMENTS) {
    return Object.values(global.ANDB_CONTEXT.ENVIRONMENTS);
  }

  // Default fallback
  return ['LOCAL', 'DEV', 'UAT', 'STAGE', 'PROD'];
}

function getCompareEnvironments() {
  // Priority: CLI options > Filter from all environments
  const envCompare = process.env.ANDB_COMPARE_ENVIRONMENTS;
  if (envCompare) {
    return envCompare.split(',').map(env => env.trim().toUpperCase());
  }

  const allEnvs = getDynamicEnvironments();
  return allEnvs.filter(env => env !== 'LOCAL');
}

function getMigrateEnvironments() {
  // Priority: CLI options > Filter from all environments
  const envMigrate = process.env.ANDB_MIGRATE_ENVIRONMENTS;
  if (envMigrate) {
    return envMigrate.split(',').map(env => env.trim().toUpperCase());
  }

  const allEnvs = getDynamicEnvironments();
  return allEnvs.filter(env => !['LOCAL', 'DEV'].includes(env));
}

// Dynamic configuration
const ENVIRONMENTS = getDynamicEnvironments();
const COMPARE_ENVIRONMENTS = getCompareEnvironments();
const MIGRATE_ENVIRONMENTS = getMigrateEnvironments();

const OPERATIONS = ['export', 'compare', 'migrate', 'deprecate'];
const DDL_TYPES = ['fn', 'sp', 'tbl', 'trg'];
const MIGRATE_TYPES = ['new', 'update'];

const DDL_MAPPING = {
  fn: '-f',
  sp: '-p',
  tbl: '-t',
  trg: '-tr'
};

const MIGRATE_COMMAND_MAPPING = {
  new: 'migrate:new',
  update: 'migrate:update'
};

const OTE_DDL_TYPES = ['fn', 'sp'];


function generateScripts() {
  const scripts = {};

  // Generate scripts for each operation
  OPERATIONS.forEach(operation => {
    if (operation === 'export') {
      generateExportScripts(scripts);
    } else if (operation === 'compare') {
      generateCompareScripts(scripts);
    } else if (operation === 'migrate') {
      generateMigrateScripts(scripts);
    } else if (operation === 'deprecate') {
      generateDeprecateScripts(scripts);
    }
  });

  return scripts;
}

function generateExportScripts(scripts) {
  ENVIRONMENTS.forEach(env => {
    // Individual export scripts
    DDL_TYPES.forEach(type => {
      scripts[`export:${env.toLowerCase()}:${type}`] = `andb export ${DDL_MAPPING[type]} ${env}`;
    });

    // Combined export script
    const exportCommands = DDL_TYPES.map(type => `npm run export:${env.toLowerCase()}:${type}`).join(' && ');
    scripts[`export:${env.toLowerCase()}`] = exportCommands;
  });
}

function generateCompareScripts(scripts) {
  COMPARE_ENVIRONMENTS.forEach(env => {
    // Individual compare scripts
    DDL_TYPES.forEach(type => {
      scripts[`compare:${env.toLowerCase()}:${type}`] = `andb compare ${DDL_MAPPING[type]} ${env}`;
    });

    // Report script
    scripts[`compare:${env.toLowerCase()}:report`] = `andb compare -r ${env}`;

    // Combined compare script
    const compareCommands = [...DDL_TYPES.map(type => `npm run compare:${env.toLowerCase()}:${type}`), `npm run compare:${env.toLowerCase()}:report`].join(' && ');
    scripts[`compare:${env.toLowerCase()}:off`] = compareCommands;

    // Full compare with export
    if (env === 'DEV') {
      scripts[`compare:${env.toLowerCase()}`] = `npm run export:${env.toLowerCase()} && npm run compare:${env.toLowerCase()}:off`;
    } else {
      const prevEnv = getPreviousEnv(env);
      scripts[`compare:${env.toLowerCase()}`] = `npm run export:${prevEnv.toLowerCase()} && npm run export:${env.toLowerCase()} && npm run compare:${env.toLowerCase()}:off`;
    }

    // Migrated compare
    scripts[`compare:${env.toLowerCase()}:migrated`] = `npm run export:${env.toLowerCase()} && npm run compare:${env.toLowerCase()}:off`;
  });
}

function generateMigrateScripts(scripts) {
  MIGRATE_ENVIRONMENTS.forEach(env => {
    // Individual migrate scripts for each type
    MIGRATE_TYPES.forEach(migrateType => {
      // New và Update scripts
      DDL_TYPES.forEach(type => {
        const command = MIGRATE_COMMAND_MAPPING[migrateType];
        scripts[`migrate:${env.toLowerCase()}:${migrateType}:${type}`] = `andb ${command} ${DDL_MAPPING[type]} ${env}`;
      });

      // Combined migrate script for type
      const migrateCommands = DDL_TYPES.map(type => `npm run migrate:${env.toLowerCase()}:${migrateType}:${type}`);
      scripts[`migrate:${env.toLowerCase()}:${migrateType}`] = migrateCommands.join(' && ');
    });

    // Full migrate script
    scripts[`migrate:${env.toLowerCase()}`] = `npm run compare:${env.toLowerCase()} && npm run migrate:${env.toLowerCase()}:new && npm run migrate:${env.toLowerCase()}:update && npm run compare:${env.toLowerCase()}:migrated`;
  });
}

function generateDeprecateScripts(scripts) {
  MIGRATE_ENVIRONMENTS.forEach(env => {
    // Deprecate scripts (bao gồm cả OTE removal)
    DDL_TYPES.forEach(type => {
      if (type === 'tbl') return; // Skip tables for deprecate

      scripts[`deprecate:${env.toLowerCase()}:${type}`] = `andb deprecate ${DDL_MAPPING[type]} ${env}`;
      // Thêm shorthand dep
      scripts[`dep:${env.toLowerCase()}:${type}`] = `andb dep ${DDL_MAPPING[type]} ${env}`;
    });

    // OTE removal scripts (chỉ fn và sp)
    OTE_DDL_TYPES.forEach(type => {
      const oteOption = type === 'fn' ? '-rmof' : '-rmos';
      scripts[`deprecate:${env.toLowerCase()}:${type}:ote`] = `andb deprecate ${oteOption} ${env}`;
      scripts[`dep:${env.toLowerCase()}:${type}:ote`] = `andb dep ${oteOption} ${env}`;
    });

    // Combined deprecate script (không bao gồm tables)
    const deprecateCommands = DDL_TYPES
      .filter(type => type !== 'tbl')
      .map(type => `npm run deprecate:${env.toLowerCase()}:${type}`)
      .concat(OTE_DDL_TYPES.map(type => `npm run deprecate:${env.toLowerCase()}:${type}:ote`))
      .join(' && ');
    scripts[`deprecate:${env.toLowerCase()}`] = deprecateCommands;
    // Thêm shorthand dep
    scripts[`dep:${env.toLowerCase()}`] = deprecateCommands;
  });
}

function getPreviousEnv(env) {
  const envIndex = ENVIRONMENTS.indexOf(env);
  return envIndex > 0 ? ENVIRONMENTS[envIndex - 1] : 'DEV';
}

function updatePackageJson() {
  // Use baseDir from global context if available, otherwise fallback to relative path
  const baseDir = global.ANDB_BASE_DIR || path.join(__dirname, '..', '..');
  const packagePath = path.join(baseDir, 'package.json');

  let packageJson;

  if (!fs.existsSync(packagePath)) {
    console.log('📦 package.json not found, creating one...');
    packageJson = {
      name: path.basename(baseDir),
      version: "1.0.0",
      description: "ANDB database migration project",
      scripts: {},
      dependencies: {}
    };
  } else {
    packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  }

  // Generate new scripts
  const newScripts = generateScripts();

  // Add utility scripts with updated paths
  newScripts['generate:scripts'] = 'andb generate';
  newScripts['helper'] = 'andb helper';
  newScripts['helper:list'] = 'andb helper --list';

  // Add test scripts
  newScripts['test'] = 'jest';
  newScripts['test:unit'] = 'mocha core/test/container.test.js core/test/file.helper.test.js core/test/report.helper.test.js --timeout 5000';
  newScripts['test:integration'] = 'mocha core/test/integration.test.js --timeout 15000';
  newScripts['test:watch'] = 'mocha core/test/**/*.test.js --watch --timeout 10000';
  newScripts['lint'] = 'eslint .';
  newScripts['lint:fix'] = 'eslint . --fix';

  packageJson.scripts = newScripts;

  fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));
  console.log('✅ Package.json scripts updated successfully!');
  console.log(`📊 Generated scripts for operations: ${OPERATIONS.join(', ')}`);
  console.log(`🔧 Migrate commands: ${Object.values(MIGRATE_COMMAND_MAPPING).join(', ')}`);
  console.log(`⚠️ Deprecate commands: deprecate, dep (shorthand)`);
  console.log(`📋 All environments: ${ENVIRONMENTS.join(', ')}`);
  console.log(`🔍 Compare environments: ${COMPARE_ENVIRONMENTS.join(', ')}`);
  console.log(`🚀 Migrate environments: ${MIGRATE_ENVIRONMENTS.join(', ')}`);

  // Show configuration source
  if (process.env.ANDB_ENVIRONMENTS || process.env.ANDB_COMPARE_ENVIRONMENTS || process.env.ANDB_MIGRATE_ENVIRONMENTS) {
    console.log(`⚙️ Configuration source: CLI options`);
    if (process.env.ANDB_ENVIRONMENTS) {
      console.log(`   📋 Environments: ${process.env.ANDB_ENVIRONMENTS}`);
    }
    if (process.env.ANDB_COMPARE_ENVIRONMENTS) {
      console.log(`   🔍 Compare: ${process.env.ANDB_COMPARE_ENVIRONMENTS}`);
    }
    if (process.env.ANDB_MIGRATE_ENVIRONMENTS) {
      console.log(`   🚀 Migrate: ${process.env.ANDB_MIGRATE_ENVIRONMENTS}`);
    }
  } else if (global.ANDB_CONTEXT) {
    console.log(`⚙️ Configuration source: CLI context`);
  } else {
    console.log(`⚙️ Configuration source: Default values`);
  }
}

// Run if called directly or from CLI
if (require.main === module || global.ANDB_BASE_DIR) {
  updatePackageJson();
}

module.exports = {
  generateScripts,
  updatePackageJson,
  getDynamicEnvironments,
  getCompareEnvironments,
  getMigrateEnvironments
}; 