/**
 * @andb/core DataStore - Abstract storage layer
 * 
 * @author ph4n4n
 * @version 1.0.0
 * @license MIT
 * @description Pluggable storage adapter for file or database
 * 
 * Copyright (c) 2024 ph4n4n
 * https://github.com/ph4n4n/@andb/core
 */

/**
 * DataStore Interface
 * Implementations: FileStore (CLI), DatabaseStore (Electron)
 */
class DataStore {
  /**
   * Save exported DDL data
   * @param {string} env - Environment (DEV, STAGE, etc)
   * @param {string} database - Database name
   * @param {string} type - DDL type (TABLES, PROCEDURES, FUNCTIONS)
   * @param {Array} data - Array of {name, ddl}
   */
  async saveExport(env, database, type, data) {
    throw new Error('saveExport must be implemented')
  }

  /**
   * Get exported DDL data
   * @param {string} env - Environment
   * @param {string} database - Database name
   * @param {string} type - DDL type
   * @returns {Array} Array of {name, ddl}
   */
  async getExport(env, database, type) {
    throw new Error('getExport must be implemented')
  }

  /**
   * Save comparison results
   * @param {string} srcEnv - Source environment
   * @param {string} destEnv - Destination environment
   * @param {string} database - Database name
   * @param {string} type - DDL type
   * @param {Array} results - Comparison results
   */
  async saveComparison(srcEnv, destEnv, database, type, results) {
    throw new Error('saveComparison must be implemented')
  }

  /**
   * Get comparison results
   * @param {string} srcEnv - Source environment
   * @param {string} destEnv - Destination environment
   * @param {string} database - Database name
   * @param {string} type - DDL type
   * @returns {Array} Comparison results
   */
  async getComparison(srcEnv, destEnv, database, type) {
    throw new Error('getComparison must be implemented')
  }

  /**
   * Get list of DDL names (replaces reading .list files)
   * @param {string} env - Environment
   * @param {string} database - Database name
   * @param {string} type - DDL type
   * @returns {Array<string>} Array of DDL names
   */
  async getDDLList(env, database, type) {
    throw new Error('getDDLList must be implemented')
  }
}

/**
 * File-based storage (default for CLI)
 * Uses existing FileManager
 */
class FileStore extends DataStore {
  constructor(fileManager, baseDir) {
    super()
    this.fileManager = fileManager
    this.baseDir = baseDir
  }

  async saveExport(env, database, type, data) {
    // Files already written by appendDDL
    // This is for compatibility
    return true
  }

  async getExport(env, database, type) {
    const listContent = this.fileManager.readFromFile(
      `db/${env}/${database}/current-ddl`,
      `${type}.list`
    )
    
    if (!listContent) return []
    
    const names = listContent.split('\n').map(l => l.trim()).filter(l => l)
    const data = []
    
    for (const name of names) {
      const ddl = this.fileManager.readFromFile(
        `db/${env}/${database}/${type}`,
        `${name}.sql`
      )
      if (ddl) {
        data.push({ name, ddl })
      }
    }
    
    return data
  }

  async getDDLList(env, database, type) {
    const listContent = this.fileManager.readFromFile(
      `db/${env}/${database}/current-ddl`,
      `${type}.list`
    )
    
    if (!listContent) return []
    return listContent.split('\n').map(l => l.trim()).filter(l => l)
  }

  async saveComparison(srcEnv, destEnv, database, type, results) {
    // Files already written by comparator
    return true
  }

  async getComparison(srcEnv, destEnv, database, type) {
    // Read from map-migrate folder
    const mapDir = `map-migrate/${srcEnv}-to-${destEnv}/${database}/${type}`
    const results = []
    
    const readList = (filename, status) => {
      try {
        const content = this.fileManager.readFromFile(mapDir, filename)
        if (!content) return
        
        const names = content.split('\n').map(l => l.trim()).filter(l => l)
        names.forEach(name => {
          results.push({ name, status, type: type.toLowerCase() })
        })
      } catch (e) {
        // File not found
      }
    }
    
    readList('new.list', 'missing_in_target')
    readList('updated.list', 'different')
    readList('deprecated.list', 'missing_in_source')
    
    return results
  }
}

/**
 * Memory-based storage (for Electron)
 * Stores data in memory, can be synced to electron-store
 */
class MemoryStore extends DataStore {
  constructor() {
    super()
    this.exports = new Map()  // key: "ENV_DB_TYPE"
    this.comparisons = new Map()  // key: "SRC_DEST_DB_TYPE"
  }

  async saveExport(env, database, type, data) {
    const key = `${env}_${database}_${type}`
    this.exports.set(key, data)
    return true
  }

  async getExport(env, database, type) {
    const key = `${env}_${database}_${type}`
    return this.exports.get(key) || []
  }

  async getDDLList(env, database, type) {
    const data = await this.getExport(env, database, type)
    return data.map(item => item.name)
  }

  async saveComparison(srcEnv, destEnv, database, type, results) {
    const key = `${srcEnv}_${destEnv}_${database}_${type}`
    this.comparisons.set(key, results)
    return true
  }

  async getComparison(srcEnv, destEnv, database, type) {
    const key = `${srcEnv}_${destEnv}_${database}_${type}`
    return this.comparisons.get(key) || []
  }

  // Helper to get all data (for syncing to electron-store)
  getAllData() {
    return {
      exports: Array.from(this.exports.entries()),
      comparisons: Array.from(this.comparisons.entries())
    }
  }
}

module.exports = {
  DataStore,
  FileStore,
  MemoryStore
}

