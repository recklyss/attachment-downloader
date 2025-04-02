import { promises as fs } from 'fs';
import path from 'path';

export function getAvailableFileName(fileName) {
  const chunks = fileName.split('.');
  if (chunks.length > 1) {
    const ext = `.${chunks[chunks.length - 1]}`;
    return chunks.slice(0, chunks.length - 1).join('.') + ' (' + Date.now() + ')' + ext;
  }
  return fileName + ' (' + Date.now() + ')';
}

export async function saveFile(fileName, content) {
  try {
    await fs.writeFile(fileName, content);
    return `${fileName} file was saved!`;
  } catch (err) {
    throw new Error(`Failed to save file ${fileName}: ${err.message}`);
  }
}

export async function isFileExist(fileName) {
  try {
    await fs.stat(fileName);
    return true;
  } catch (err) {
    return false;
  }
}

export function getParentDir(argv, baseDir, time) {
  const date = new Date(Number(time));
  let dirPath = path.resolve(baseDir, 'files');

  if (argv.from) {
    dirPath = path.resolve(baseDir, 'files', argv.from);
  }

  if (argv.fy) {
    dirPath = path.resolve(dirPath, String(date.getFullYear()));
  }

  return dirPath;
}

export default {
  getAvailableFileName,
  saveFile,
  isFileExist,
  getParentDir
};
