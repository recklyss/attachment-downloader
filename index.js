import _ from 'lodash';
import { promises as fs } from 'fs';
import inquirer from 'inquirer';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import ora from 'ora';

import googleAPI from './lib/googleAPIWrapper.js';
import FileHelper from './lib/fileHelper.js';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let pageCounter = 1;
let messageIds = [];
let gmail;

const spinner = ora('Processing...');

// Remove prototype modification and use a proper function
const replaceAll = (str, search, replacement) => str.split(search).join(replacement);

async function main() {
  try {
    const { auth, gmail: gmailInstance } = await googleAPI.getAuthAndGmail();
    gmail = gmailInstance; // Set the global gmail instance
    const coredata = {};

    spinner.start('Initializing...');

    const workflow = process.argv.length > 2 ? scanForLabelOption : defaultBehaviour;
    const mailList = await workflow(auth, gmail, coredata);

    spinner.text = 'Fetching mail contents...';
    const mails = await fetchMailsByMailIds(auth, mailList);

    const attachments = pluckAllAttachments(mails);
    await fetchAndSaveAttachments(auth, gmail, attachments);

    spinner.succeed('All attachments downloaded successfully');
  } catch (error) {
    spinner.fail('An error occurred');
    console.error('Error:', error);
    process.exit(1);
  }
}

async function defaultBehaviour(auth, gmail, coredata) {
  const option = await askForFilter();

  if (option === 'label') {
    const response = await gmail.users.labels.list({ userId: 'me' });
    const labels = response.data.labels;
    const selectedLabel = await askForLabel(labels);
    coredata.label = selectedLabel;

    spinner.text = 'Fetching emails by label...';
    return getListOfMailIdByLabel(auth, gmail, selectedLabel.id, 200);
  }

  if (option === 'from') {
    const mailId = await askForMail();
    spinner.text = 'Fetching emails from sender...';
    return getListOfMailIdByFromId(auth, gmail, mailId, 50);
  }

  spinner.text = 'Fetching all emails...';
  return getAllMails(auth, gmail, 500);
}

async function scanForLabelOption(auth, gmail) {
  const [, , option, labelName] = process.argv;

  if (option !== '--label' || !labelName) {
    throw new Error('Expected --label LABEL_NAME option');
  }

  const response = await gmail.users.labels.list({ userId: 'me' });
  const labelObj = response.data.labels.find(l => l.name === labelName);

  if (!labelObj) {
    throw new Error(`Label "${labelName}" not found`);
  }

  return getListOfMailIdByLabel(auth, gmail, labelObj.id, 200);
}

async function fetchAndSaveAttachments(auth, gmail, attachments) {
  const results = [];
  const batchSize = 100;
  let processed = 0;

  const validAttachments = attachments.filter(att => att.id);
  const totalAttachments = validAttachments.length;

  for (let i = 0; i < validAttachments.length; i += batchSize) {
    const batch = validAttachments.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(att => fetchAndSaveAttachment(auth, gmail, att))
    );

    results.push(...batchResults);
    processed += batch.length;
    spinner.text = `Saved ${processed}/${totalAttachments} attachments`;
  }

  return results;
}

async function fetchAndSaveAttachment(auth, gmail, attachment) {
  try {
    const response = await gmail.users.messages.attachments.get({
      auth,
      userId: 'me',
      messageId: attachment.mailId,
      id: attachment.id
    });

    if (!response || !response.data) {
      throw new Error('Empty response from Gmail API');
    }

    const data = response.data.data
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const content = Buffer.from(data, 'base64');
    const fileName = path.resolve(__dirname, 'files', attachment.name);
    const finalFileName = await FileHelper.getAvailableFileName(fileName);

    await FileHelper.saveFile(finalFileName, content);
    return { success: true, fileName: finalFileName };
  } catch (error) {
    console.error(`Failed to save attachment ${attachment.name}:`, error);
    return { success: false, fileName: attachment.name, error };
  }
}

/**
 * Lists the labels in the user's account.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
function listLabels(auth, gmail) {
  return new Promise((resolve, reject) => {
    gmail.users.labels.list({
      auth: auth,
      userId: 'me',
    }, (err, response) => {
      if (err) {
        console.log('The API returned an error: ' + err);
        reject(err);
      }
      resolve(response);
    });
  })
}

function askForLabel(labels) {
  return inquirer.prompt([
    {
      type: 'list',
      name: 'label',
      message: 'Choose label for filter mails:',
      choices: _.map(labels, 'name'),
      filter: val => _.find(labels, l => l.name === val)
    }
  ])
    .then(answers => answers.label);
}

function askForFilter(labels) {
  return inquirer.prompt([
    {
      type: 'list',
      name: 'option',
      message: 'How do you like to filter',
      choices: ['Using from email Id', 'Using label', "All"],
      filter: val => {
        if (val === 'Using from email Id') {
          return 'from';
        } else if (val === 'Using label') {
          return 'label';
        } else {
          return 'all'
        }
      }
    }
  ])
    .then(answers => answers.option);
}

function askForMail() {
  return inquirer.prompt([
    {
      type: 'input',
      name: 'from',
      message: 'Enter from mailId:'
    }
  ])
    .then(answers => answers.from);
}

function getListOfMailIdByLabel(auth, gmail, labelId, maxResults = 500, nextPageToken) {
  return new Promise((resolve, reject) => {
    gmail.users.messages.list({
      auth: auth,
      userId: 'me',
      labelIds: labelId,
      maxResults: maxResults,
      pageToken: nextPageToken ? nextPageToken : undefined
    }, function (err, response) {
      if (err) {
        console.log('The API returned an error: ' + err);
        reject(err);
      }
      if (response.data) {
        messageIds = messageIds.concat(response.data.messages)
        if (response.data.nextPageToken) {
          spinner.text = "Reading page: " + ++pageCounter
          resolve(getListOfMailIdByLabel(auth, gmail, labelId, maxResults, response.data.nextPageToken))
        }
      }
      spinner.text = "All pages are read"
      resolve(messageIds)
    });
  });
}

function getAllMails(auth, gmail, maxResults = 500, nextPageToken) {
  return new Promise((resolve, reject) => {
    gmail.users.messages.list({
      auth: auth,
      userId: 'me',
      maxResults: maxResults,
      pageToken: nextPageToken ? nextPageToken : undefined
    }, function (err, response) {
      if (err) {
        console.log('The API returned an error: ' + err);
        reject(err);
      }
      if (response.data) {
        messageIds = messageIds.concat(response.data.messages)
        if (response.data.nextPageToken) {
          spinner.text = "Reading page: " + ++pageCounter
          resolve(getAllMails(auth, gmail, maxResults, response.data.nextPageToken))
        }
      }
      spinner.text = "All pages are read"
      resolve(messageIds)
    });
  });
}

function getListOfMailIdByFromId(auth, gmail, mailId, maxResults = 500) {
  return new Promise((resolve, reject) => {
    gmail.users.messages.list({
      auth: auth,
      userId: 'me',
      q: 'from:' + mailId,
      maxResults: maxResults
    }, function (err, response) {
      if (err) {
        console.log('The API returned an error: ' + err);
        reject(err);
      }
      resolve(response.data.messages);
    });
  });
}

async function fetchMailsByMailIds(auth, mailList) {
  const results = [];
  const batchSize = 100;
  const delay = 3000; // 3 seconds delay between batches
  let processed = 0;

  spinner.text = "Fetching emails...";

  try {
    // Process emails in batches
    for (let i = 0; i < mailList.length; i += batchSize) {
      const batch = mailList.slice(i, Math.min(i + batchSize, mailList.length));
      const validBatch = batch.filter(mail => mail && mail.id);

      if (validBatch.length > 0) {
        const batchPromises = validBatch.map(mail => getMail(auth, mail.id));
        const batchMails = await Promise.all(batchPromises);
        results.push(...batchMails);

        processed += validBatch.length;
        spinner.text = `Fetched ${processed}/${mailList.length} emails`;

        // Add delay between batches to avoid rate limiting
        if (i + batchSize < mailList.length) {
          spinner.text = `Waiting ${delay / 1000}s before next batch...`;
          await sleep(delay);
        }
      }
    }

    return results;
  } catch (error) {
    spinner.fail(`Error fetching emails: ${error.message}`);
    throw error;
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getMail(auth, mailId) {
  try {
    const response = await gmail.users.messages.get({
      userId: 'me',
      id: mailId,
      auth,
    });
    return response;
  } catch (error) {
    console.error(`Failed to fetch email ${mailId}:`, error.message);
    return null;
  }
}

function pluckAllAttachments(mails) {
  return _.compact(_.flatten(_.map(mails, (m) => {
    if (!m.data || !m.data.payload || !m.data.payload.parts) {
      return undefined;
    }
    if (m.data.payload.mimeType === "multipart/signed") {
      return _.flatten(_.map(m.data.payload.parts, (p) => {
        if (p.mimeType !== "multipart/mixed") {
          return undefined;
        }
        return _.map(p.parts, (pp) => {
          if (!pp.body || !pp.body.attachmentId) {
            return undefined;
          }
          const attachment = {
            mailId: m.data.id,
            name: pp.filename,
            id: pp.body.attachmentId
          };
          return attachment;
        })
      }))
    } else {
      return _.map(m.data.payload.parts, (p) => {
        if (!p.body || !p.body.attachmentId) {
          return undefined;
        }
        const attachment = {
          mailId: m.data.id,
          name: p.filename,
          id: p.body.attachmentId
        };
        return attachment;
      })
    }
  })));
}

// Start the application
main().catch(console.error);
