#!/usr/bin/env node
const { google } = require('googleapis');

const sheets = google.sheets('v4');
const fs = require('fs');
const _ = require('lodash');
const authorizationHelpers = require('./authorizationHelpers');
const helpers = require('./helpers');

const getRequest = {
  spreadsheetId: helpers.SpreadsheetId,
  ranges: [],
  includeGridData: false,
  auth: '',
};

const sheetRequest = {
  spreadsheetId: helpers.SpreadsheetId,
  resource: {
    requests: [],
  },
  auth: '',
};

const dataRemoveRequest = {
  spreadsheetId: helpers.SpreadsheetId,
  resource: {
    requests: [],
  },
  auth: '',
};

const dataPostRequest = {
  spreadsheetId: helpers.SpreadsheetId,
  resource: {
    requests: [],
  },
  auth: '',
};

const diff = async (authClient) => {
  getRequest.auth = authClient;
  const getResponse = await sheets.spreadsheets.get(getRequest);
  const remoteSheets = getResponse.data.sheets.map(el => el.properties);

  helpers.diff(remoteSheets);
};

const pushSheets = async (authClient) => {
  helpers.setRequestsAuth(sheetRequest, dataRemoveRequest, dataPostRequest, getRequest, authClient);
  const response = await sheets.spreadsheets.get(getRequest);

  const modules = helpers.languages();
  helpers.standardizeModules(modules);

  await helpers.formAddSheetRequests(sheetRequest, response);
  await helpers.formDeleteSheetRequests(sheetRequest, response);

  if (!_.isEmpty(sheetRequest.resource.requests)) {
    await sheets.spreadsheets.batchUpdate(sheetRequest);
  }
};

const pushData = async () => {
  const iterNum = helpers.largestSubDirFilesCount(helpers.LangsPath);
  const resp = await sheets.spreadsheets.get(getRequest);

  for (let i = 0; i < iterNum; i++) {
    const file = resp.data.sheets.map(el => el.properties)
      .find(el => el.title === helpers.FileNames[i]);
    // eslint-disable-next-line no-await-in-loop
    await helpers.formRequestsForPush(dataRemoveRequest, dataPostRequest, file.sheetId);
    // eslint-disable-next-line no-await-in-loop
    await helpers.prepareData(file, i, dataPostRequest);
  }

  if (!_.isEmpty(dataRemoveRequest.resource.requests)) {
    await sheets.spreadsheets.batchUpdate(dataRemoveRequest);
  }
  if (!_.isEmpty(dataPostRequest.resource.requests)) {
    await sheets.spreadsheets.batchUpdate(dataPostRequest);
  }
};

const pullSheets = async (authClient) => {
  getRequest.auth = authClient;
  const response = await sheets.spreadsheets.get(getRequest);
  const sheetNames = response.data.sheets.map(el => el.properties.title);

  helpers.Langs.forEach((lang, i) => {
    helpers.createFiles(sheetNames, i);
    helpers.deleteFiles(sheetNames, i);
  });
};

const pullData = async () => {
  const iterNum = helpers.largestSubDirFilesCount(helpers.LangsPath);
  const response = await sheets.spreadsheets.get(getRequest);

  for (let i = 0; i < iterNum; i++) {
    const fileNames = fs.readdirSync(`${helpers.LangsPath}/${helpers.Langs[0]}`);
    const file = response.data.sheets.map(el => el.properties)
      .find(el => el.title === fileNames[i].substr(0, fileNames[i].lastIndexOf('.')));
    // eslint-disable-next-line no-await-in-loop
    await helpers.prepareData(file, i);
  }
};

// eslint-disable-next-line consistent-return
fs.readFile('./credentials.json', (err, content) => {
  if (err) return console.log('Error loading client secret file:', err);
  authorizationHelpers.authorize(JSON.parse(content), async authClient => {
    switch (process.argv[2].toLowerCase()) {
      case 'diff':
        await diff(authClient);
        break;
      case 'push':
        await pushSheets(authClient);
        await pushData();
        break;
      case 'pull':
        await pullSheets(authClient);
        await pullData();
        break;
      case 'init':
        fs.writeFileSync('./Localization/spreadsheet', process.argv[3]);
        break;
      default:
        break;
    }
  });
});
