import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import ora from 'ora';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const spinner = ora('Processing PDFs...');

async function decryptPDFs(password) {
  try {
    spinner.start('Reading files directory...');

    // Read all files in the files directory
    const filesDir = path.join(__dirname, 'files');
    const files = await fs.readdir(filesDir);
    const pdfFiles = files.filter(file => file.toLowerCase().endsWith('.pdf'));

    if (pdfFiles.length === 0) {
      spinner.info('No PDF files found in the files directory.');
      return;
    }

    spinner.info(`Found ${pdfFiles.length} PDF files`);

    // Create decrypted directory if it doesn't exist
    const decryptedDir = path.join(__dirname, 'decrypted');
    await fs.mkdir(decryptedDir, { recursive: true });

    let successCount = 0;
    let failCount = 0;

    // Process each PDF file
    for (const [index, file] of pdfFiles.entries()) {
      const inputPath = path.join(filesDir, file);
      const outputPath = path.join(decryptedDir, file.replace('.pdf', '_decrypted.pdf'));

      spinner.text = `Decrypting file ${index + 1}/${pdfFiles.length}: ${file}`;

      try {
        await execAsync(`qpdf --password=${password} --decrypt "${inputPath}" "${outputPath}"`);
        successCount++;
      } catch (error) {
        console.error(`\nFailed to decrypt ${file}:`, error.message);
        failCount++;
      }
    }

    if (successCount > 0) {
      spinner.succeed(`Successfully decrypted ${successCount} files. Check the 'decrypted' directory.`);
    }
    if (failCount > 0) {
      spinner.warn(`Failed to decrypt ${failCount} files.`);
    }
  } catch (error) {
    spinner.fail('An error occurred');
    console.error('Error:', error);
    process.exit(1);
  }
}

// Check if password is provided as command line argument
const password = process.argv[2];
if (!password) {
  console.error('Please provide the PDF password as a command line argument.');
  console.error('Usage: node decrypt-pdfs.js <password>');
  process.exit(1);
}

decryptPDFs(password).catch(console.error); 