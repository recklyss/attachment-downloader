# Gmail Bulk Attachment Downloader

A modern Node.js utility to bulk download attachments from Gmail. This tool allows you to easily download attachments from multiple emails using Gmail labels.

## Features

- 🚀 Download attachments from multiple emails in one go
- 📁 Filter emails by labels or sender
- 🔓 Built-in PDF password removal tool
- 📅 Automatic file organization with date-based naming
- 🔒 Secure OAuth2 authentication with Gmail API

## Prerequisites

1. Node.js >= 16.0.0
2. Gmail API credentials
   - Visit [Google Cloud Console](https://console.cloud.google.com)
   - Enable Gmail API for your project
   - Create OAuth 2.0 credentials
   - Download and save as `credentials.json` in the project root

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/recklyss/attachment-downloader.git
   cd attachment-downloader
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## Usage

### Download Attachments

Run the program:
```bash
npm start
```

Follow the interactive prompts to:
1. Choose filtering method (by label or sender)
2. Select the emails to process
3. Wait for attachments to download

### Remove PDF Passwords

If your PDFs are password-protected, use the decrypt tool:
```bash
node decrypt-pdfs.js <password>
```

### Rename Files to Date Format

To rename the decrypted PDFs to YYYY-MM-DD format:
```bash
node rename-files.js
```

## File Organization

- `/files` - Original downloaded attachments
- `/decrypted` - Password-removed PDFs
- All files are automatically renamed to `YYYY-MM-DD_payslip.pdf` format

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
