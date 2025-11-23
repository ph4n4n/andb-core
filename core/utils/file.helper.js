const fs = require('fs');
const path = require('path');

class FileManager {
  constructor(baseDir) {
    this.baseDir = baseDir || process.cwd();
  }

  static getInstance(baseDir) {
    if (!this.instance || this.instance.baseDir !== baseDir) {
      this.instance = new FileManager(baseDir);
    }
    return this.instance;
  }

  readFromFile(folder, fileName, returnArray = false) {
    const filePath = path.join(this.baseDir, folder, fileName);
    const fileContent = !fs.existsSync(filePath)
      ? ''
      : fs.readFileSync(filePath, 'utf8').trim();
    return !returnArray
      ? fileContent
      : fileContent.split('\n').filter(Boolean)
      ;
  }

  /**
   * Copy content from source file to destination file, create if not existed
   * @param {string} sourceFile - Path to the source file
   * @param {string} destinationFile - Path to the destination file
   */
  copyFile(sourceFile, destinationFile) {
    try {
      const content = fs.readFileSync(sourceFile, 'utf8');
      fs.writeFileSync(destinationFile, content);
    } catch (error) {
      // skip error: ENOENT
      if (error.code === 'ENOENT') {
        return;
      }
      console.error('Error occurred while copying the content:', error);
    }
  }

  /**
   * Save the file
   * @param {*} content
   * @param {*} filePath
   * @returns {Promise<void>}
   */
  saveToFile(folder, fileName, content) {
    const filePath = path.join(this.baseDir, folder, fileName);
    if (typeof content !== 'string') {
      const error = new Error(`Invalid content for file ${filePath}`);
      if (global.logger) global.logger.error(error);
      else console.error(error);
      throw error;
    }
    if (folder.indexOf(this.baseDir) == -1) {
      FileManager.getInstance(this.baseDir).makeSureFolderExisted(folder);
    }
    fs.writeFileSync(filePath, content);
  }


  makeSureFolderExisted(folder) {
    // const folderPath = path.join(this.baseDir, folder); // Get the absolute path of the folder

    const folders = folder.split('/');

    // Recursive function to create folders from parent to child
    function createFoldersRecursively(index, currentPath) {
      if (index === folders.length) {
        // Base case: All folders have been created
        return;
      }

      // Append the current folder to the current path
      currentPath = path.join(currentPath, folders[index]);

      // Check if the current folder exists
      if (!fs.existsSync(currentPath)) {
        // If the folder doesn't exist, create it
        fs.mkdirSync(currentPath); // Create the folder synchronously
      }

      // Recursively call the function with the next folder
      createFoldersRecursively(index + 1, currentPath);
    }

    // Start the recursive creation of folders
    createFoldersRecursively(0, this.baseDir);
  }


  /**
   * Clean the specified folder by removing all files within it
   * @param {*} folderPath The path to the folder
   */
  emptyDirectory(folder) {
    try {
      const folderPath = path.join(this.baseDir, folder);
      if (fs.existsSync(folderPath)) {
        const files = fs.readdirSync(folderPath);
        for (const file of files) {
          const filePath = path.join(folderPath, file);
          fs.unlinkSync(filePath);
        }
      }
    } catch (err) {
      if (global.logger) global.logger.error(`Error cleaning folder ${folder}: `, err);
      else console.error(`Error cleaning folder ${folder}: `, err);
    }
  }

  // remove file
  removeFile(folder, fileName) {
    try {
      const filePath = path.join(this.baseDir, folder, fileName);
      fs.unlinkSync(filePath);
    } catch (err) {
      if (global.logger) global.logger.error(`Error cleaning file ${fileName}: `, err);
      else console.error(`Error cleaning file ${fileName}: `, err);
    }
  }
}

// Export factory function instead of singleton instance
module.exports = FileManager;
