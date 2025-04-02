import { promises as fs } from 'fs';
import { google } from 'googleapis';
import http from 'http';
import { parse } from 'url';

const PORT = 47319;

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = 'token.json';

class GoogleAPIWrapper {
  constructor() {
    this.server = null;
  }

  async getAuthAndGmail() {
    try {
      const content = await fs.readFile('credentials.json');
      const auth = await this.authorize(JSON.parse(content));
      const gmail = google.gmail({ version: 'v1', auth });
      return { auth, gmail };
    } catch (err) {
      console.error('Error loading client secret file:', err);
      throw err;
    }
  }

  /**
   * Create an OAuth2 client with the given credentials, and then execute the
   * given callback function.
   * @param {Object} credentials The authorization client credentials.
   * @param {function} callback The callback to call with the authorized client.
   */
  async authorize(credentials) {
    if (!credentials.installed) {
      throw new Error('Invalid credentials format. Make sure you have downloaded the correct credentials.json file from Google Cloud Console.');
    }

    const { client_secret, client_id, redirect_uris } = credentials.installed;
    const oAuth2Client = new google.auth.OAuth2(
      client_id,
      client_secret,
      `http://localhost:${PORT}`
    );

    try {
      const token = await fs.readFile(TOKEN_PATH);
      oAuth2Client.setCredentials(JSON.parse(token));
      return oAuth2Client;
    } catch (err) {
      return this.getNewToken(oAuth2Client);
    }
  }

  /**
   * Get and store new token after prompting for user authorization, and then
   * execute the given callback with the authorized OAuth2 client.
   * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
   * @param {getEventsCallback} callback The callback for the authorized client.
   */
  async getNewToken(oAuth2Client) {
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
    });
    console.log('Authorize this app by visiting this url:', authUrl);

    return new Promise((resolve, reject) => {
      this.server = http.createServer(async (req, res) => {
        try {
          const queryObject = parse(req.url, true).query;

          if (!queryObject.code) {
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.write('<h1>Authentication failed. No authorization code received.</h1>');
            res.end();
            return;
          }

          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.write('<h1>Authentication successful! You can close this window.</h1>');
          res.end();

          try {
            const { tokens } = await oAuth2Client.getToken(queryObject.code);
            oAuth2Client.setCredentials(tokens);
            await fs.writeFile(TOKEN_PATH, JSON.stringify(tokens));
            console.log('Token stored to', TOKEN_PATH);

            if (this.server) {
              this.server.close();
              this.server = null;
            }

            resolve(oAuth2Client);
          } catch (tokenError) {
            console.error('Error getting tokens:', tokenError);
            reject(tokenError);
          }
        } catch (err) {
          console.error('Error in authorization callback:', err);
          reject(err);
        }
      });

      this.server.on('error', (err) => {
        console.error('Server error:', err);
        reject(err);
      });

      try {
        this.server.listen(PORT, () => {
          console.log(`Listening for OAuth2 callback on port ${PORT}`);
        });
      } catch (err) {
        console.error('Error starting server:', err);
        reject(err);
      }
    });
  }

  /**
   * Lists the labels in the user's account.
   *
   * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
   */
  async listLabels(auth) {
    const gmail = google.gmail({ version: 'v1', auth });
    try {
      const response = await gmail.users.labels.list({
        userId: 'me',
      });
      const labels = response.data.labels;
      if (labels.length) {
        console.log('Labels:');
        labels.forEach((label) => {
          console.log(`- ${label.name}`);
        });
      } else {
        console.log('No labels found.');
      }
    } catch (err) {
      console.error('The API returned an error:', err);
      throw err;
    }
  }
}

export default new GoogleAPIWrapper();
