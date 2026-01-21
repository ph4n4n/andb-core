/**
 * Report Demo High-Fidelity Generator
 * Run this to see how the new premium report looks with realistic mock data.
 */
const { ReportHelper } = require('../../src/utils/report.helper');
const path = require('path');
const fs = require('fs');

// Mock dependencies
const mockFileManager = {
  makeSureFolderExisted: (p) => {
    const fullPath = path.join(__dirname, '../..', p);
    if (!fs.existsSync(fullPath)) fs.mkdirSync(fullPath, { recursive: true });
  },
  readFromFile: (folder, file) => {
    // Handle template path correctly as per source
    if (folder === 'src/reports/html' && file === 'template.html') {
      return fs.readFileSync(path.join(__dirname, '../../src/reports/html/template.html'), 'utf8');
    }

    // Mocking .list files for different types with realistic names
    if (file.endsWith('.list')) {
      const isNew = file.includes('new');
      const isUpdated = file.includes('updated');
      const isDeprecated = file.includes('deprecated');

      if (file.includes('TABLES')) {
        if (isNew) return "analytics_events\nsubscription_tiers\nmarketing_campaigns";
        if (isUpdated) return "users\norders\nbilling_profiles";
        if (isDeprecated) return "legacy_trackers\ntmp_migration_v1";
      }
      if (file.includes('VIEWS')) {
        if (isNew) return "v_active_subscriptions";
        if (isUpdated) return "v_order_summary";
        if (isDeprecated) return "v_old_user_stats";
      }
      if (file.includes('PROCEDURES')) {
        if (isNew) return "sp_recalculate_revenue\nsp_archive_logs";
        if (isUpdated) return "sp_process_order\nsp_sync_crm_data";
        if (isDeprecated) return "";
      }
      if (file.includes('FUNCTIONS')) {
        if (isNew) return "fn_get_user_segment\nfn_calculate_tax";
        if (isUpdated) return "fn_format_currency\nfn_validate_coupon";
        if (isDeprecated) return "fn_legacy_hash";
      }
      if (file.includes('TRIGGERS')) {
        if (isNew) return "tr_audit_user_update";
        if (isUpdated) return "tr_update_inventory_count";
        if (isDeprecated) return "";
      }
      if (file.includes('EVENTS')) {
        if (isNew) return "";
        if (isUpdated) return "ev_nightly_cleanup";
        if (isDeprecated) return "ev_weekly_stats_v1";
      }
    }

    // Mocking the JSON report - MUST BE NESTED for revertAndJoin to work
    if (folder.includes('test/reports/json')) {
      const mockJson = {
        tables: { total: 124, new: 3, updated: 3, deprecated: 2 },
        views: { total: 18, new: 1, updated: 1, deprecated: 1 },
        procedures: { total: 45, new: 2, updated: 2, deprecated: 0 },
        functions: { total: 32, new: 2, updated: 2, deprecated: 1 },
        triggers: { total: 12, new: 1, updated: 1, deprecated: 0 },
        events: { total: 8, new: 0, updated: 1, deprecated: 1 },
        columns: {
          missing: {
            "users": ["ssn_encrypted", "last_login_ip"],
            "orders": ["tracking_provider_id", "delivery_instructions"],
            "billing_profiles": ["stripe_customer_id"]
          }
        }
      };
      return JSON.stringify(mockJson, null, 2);
    }

    return "";
  },
  saveToFile: (folder, file, content) => {
    const fullPath = path.join(__dirname, '../..', folder);
    if (!fs.existsSync(fullPath)) fs.mkdirSync(fullPath, { recursive: true });
    fs.writeFileSync(path.join(fullPath, file), content);
    console.log(`✅ File generated: ${path.join(folder, file)}`);
  }
};

const deps = {
  getSourceEnv: () => 'STAGING',
  getDBName: () => 'ANDB_ORCHESTRATOR_CORE',
  fileManager: mockFileManager,
  reportDir: 'test/reports'
};

const helper = new ReportHelper(deps);

async function runDemo() {
  console.log("🚀 Generating Premium THE ANDB High-Fidelity Report Demo...");

  // 1. Create mock directory structure for demo
  mockFileManager.makeSureFolderExisted(`${deps.reportDir}/json`);

  // 2. Generate HTML (it will read via the mockFileManager)
  await helper.report2html('PRODUCTION');

  console.log(`\n✨ Done! Open ${deps.reportDir}/ANDB_ORCHESTRATOR_CORE.PRODUCTION.html in your browser to see the impact.`);
}

runDemo().catch(console.error);
