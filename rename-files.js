import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import ora from 'ora';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const spinner = ora('Processing files...');

const monthMap = {
  'January': '01',
  'February': '02',
  'March': '03',
  'April': '04',
  'May': '05',
  'June': '06',
  'July': '07',
  'August': '08',
  'September': '09',
  'October': '10',
  'November': '11',
  'December': '12'
};

async function renameFiles() {
  try {
    spinner.start('Reading decrypted directory...');

    const decryptedDir = path.join(__dirname, 'decrypted');
    const files = await fs.readdir(decryptedDir);
    const pdfFiles = files.filter(file => file.toLowerCase().endsWith('_decrypted.pdf'));

    if (pdfFiles.length === 0) {
      spinner.info('No decrypted PDF files found.');
      return;
    }

    spinner.info(`Found ${pdfFiles.length} PDF files to rename`);

    let successCount = 0;
    let failCount = 0;

    for (const file of pdfFiles) {
      try {
        // Extract year and month from filename
        const match = file.match(/(\d{4})_([\w]+)_/);
        if (!match) {
          throw new Error('Could not extract date from filename');
        }

        const [, year, month] = match;
        const monthNum = monthMap[month];
        if (!monthNum) {
          throw new Error(`Invalid month: ${month}`);
        }

        // Create new filename in YYYY-MM-DD format
        // Since we don't have the day, we'll use the first day of the month
        const newName = `${year}-${monthNum}-01_payslip.pdf`;
        const oldPath = path.join(decryptedDir, file);
        const newPath = path.join(decryptedDir, newName);

        // Check if target file already exists
        try {
          await fs.access(newPath);
          // If file exists, add a suffix
          const [baseName, ext] = newName.split('.');
          const newNameWithSuffix = `${baseName}_${Date.now()}.${ext}`;
          await fs.rename(oldPath, path.join(decryptedDir, newNameWithSuffix));
        } catch {
          // File doesn't exist, proceed with normal rename
          await fs.rename(oldPath, newPath);
        }

        spinner.text = `Renamed: ${file} → ${newName}`;
        successCount++;
      } catch (error) {
        console.error(`\nFailed to rename ${file}:`, error.message);
        failCount++;
      }
    }

    if (successCount > 0) {
      spinner.succeed(`Successfully renamed ${successCount} files.`);
    }
    if (failCount > 0) {
      spinner.warn(`Failed to rename ${failCount} files.`);
    }
  } catch (error) {
    spinner.fail('An error occurred');
    console.error('Error:', error);
    process.exit(1);
  }
}

renameFiles().catch(console.error); 