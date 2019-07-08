const { join } = require('path');
const fs = require('fs');
const readline = require('readline');
const _ = require('lodash');
const csv = require('csv-parser');
const https = require('https');

const LangsPath = 'public/locales'; // project structure assumption

const getLanguages = path => fs.readdirSync(path)
  .filter(f => fs.statSync(join(path, f)).isDirectory());

const SpreadsheetId = fs.readFileSync('./spreadsheet', 'utf-8');
const Langs = getLanguages(LangsPath);
const Headers = ['key'].concat(Langs);

const FileNames = [];

// refactor (logic, size)
const _cli = async (j, file, rowSheet, data, mergedData) => {
  const isPull = process.argv[2].toLowerCase() === 'pull';
  process.stdout.write('File name: ');
  console.log('\x1b[36m%s\x1b[0m', file.title);
  console.log('\x1b[35m%s\x1b[0m', 'remote');
  console.log(rowSheet);
  console.log('\x1b[32m%s\x1b[0m', 'local');
  console.log(data[j]);
  console.log('\x1b[33m');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  let opt = await new Promise(resolve => {
    const Question = isPull
      ? 'Override local? [Y/n]'
      : 'Override remote? [Y/n]';
    rl.question(Question, resolve);
  });
  opt = opt.toLowerCase();
  console.log('\x1b[0m');
  const isDefautOpt = (opt === 'y' || opt === '');
  const toPull = isDefautOpt ? rowSheet : data[j];
  const toPush = isDefautOpt ? data[j] : rowSheet;
  mergedData.push(isPull ? toPull : toPush);

  rl.close();
};

const _mergeArrays = (arrays) => {
  let jointArray = [];

  arrays.forEach(array => {
    jointArray = [...jointArray, ...array];
  });

  const uniqueArray = jointArray.filter((item, index) => jointArray.indexOf(item) === index);
  return uniqueArray;
};

// eslint-disable-next-line arrow-body-style
const _flatten = (object) => {
  // eslint-disable-next-line wrap-iife
  return Object.assign({}, ...function flatten(child, path = []) {
    return [].concat(...Object.keys(child).map(key => (typeof child[key] === 'object'
      ? flatten(child[key], path.concat([key]))
      : ({ [path.concat([key]).join('.')]: child[key] })),
    ));
  }(object));
};

const _unflatten = (object) => {
  const result = {};
  for (const i in object) {
    if ({}.hasOwnProperty.call(object, i)) {
      const keys = i.split('.');
      // eslint-disable-next-line arrow-body-style
      keys.reduce((r, e, j) => {
        // eslint-disable-next-line no-nested-ternary, no-return-assign
        return r[e] || (r[e] = Number.isNaN(Number(keys[j + 1]))
          ? (keys.length - 1 === j ? object[i] : {})
          : []);
      }, result);
    }
  }
  return result;
};

const _standardizeKeys = (i, diffKeys) => {
  const tmp = [];
  Langs.forEach(lang => {
    const file = fs.readdirSync(`${LangsPath}/${lang}`)[i];
    if (file) {
      const fileName = file;
      let contents = JSON.parse(fs.readFileSync(`${LangsPath}/${lang}/${fileName}`, 'utf-8'));
      contents = _flatten(contents);

      diffKeys.forEach(key => {
        if (!{}.hasOwnProperty.call(contents, key)) {
          contents[key] = '';
        }
      });

      tmp.push(contents);
      fs.writeFileSync(`${LangsPath}/${lang}/${fileName}`, JSON.stringify(_unflatten(contents), null, 2));
    }
  });
  return tmp;
};

const _diffKeysArray = (j, contents, diffKeys, fileName) => {
  let otherObj = JSON.parse(fs.readFileSync(`${LangsPath}/${Langs[j - 1]}/${fileName}`, 'utf-8'));
  otherObj = _flatten(otherObj);
  return _.difference(_.keys(otherObj), _.keys(contents))
    .concat(diffKeys, _.difference(_.keys(contents), _.keys(otherObj)));
};

const _mergeObjects = (i) => {
  const tmp = [];
  let fileName = '';
  let diffKeys = [];
  Langs.forEach((lang, j) => {
    const file = fs.readdirSync(`${LangsPath}/${lang}`)[i];
    if (file) {
      fileName = file;
      let contents = JSON.parse(fs.readFileSync(`${LangsPath}/${lang}/${fileName}`, 'utf-8'));
      contents = _flatten(contents);
      if (!_.isEmpty(contents)) tmp.push(contents);
      if (j === 0) return;
      diffKeys = _diffKeysArray(j, contents, diffKeys, fileName);
    }
  });
  return [tmp, fileName, diffKeys];
};

const _standardizeData = (i) => {
  // eslint-disable-next-line prefer-const
  let [tmp, fileName, diffKeys] = _mergeObjects(i);

  if (!_.isEmpty(diffKeys)) tmp = _standardizeKeys(i, diffKeys);

  return [fileName.substr(0, fileName.lastIndexOf('.')), tmp];
};

const _parseSheetData = (tmp) => {
  const sheetData = [];
  sheetData.push(_.keys(tmp[0]));
  tmp.forEach((row) => {
    if (row.key === '') return;
    sheetData.push([]);
    for (const key in row) {
      if ({}.hasOwnProperty.call(row, key)) {
        sheetData[sheetData.length - 1].push(row[key]);
      }
    }
  });
  return sheetData;
};

const _mergeData = async (file, tmp, data) => {
  const mergedData = [];
  const sheetData = _parseSheetData(tmp);
  const localDataKeys = data.map(el => el[0]);

  for (let j = 0; j < localDataKeys.length; j++) {
    const rowSheet = sheetData.find(el => el[0] === localDataKeys[j]);
    if (rowSheet && !_.isEqual(rowSheet, data[j])) {
      // eslint-disable-next-line no-await-in-loop
      await _cli(j, file, rowSheet, data, mergedData);
    } else {
      mergedData.push(data[j]);
    }
  }

  sheetData.forEach(row => {
    const rowData = data.find(el => el[0] === row[0]);
    if (!rowData) {
      mergedData.push(row);
    }
  });

  return mergedData;
};

const _overrideOrImportPull = (file, remoteData) => {
  const parsedRemote = _parseSheetData(remoteData).slice(1);
  Langs.forEach((lang, j) => {
    const contents = {};
    parsedRemote.forEach(row => {
      contents[row[0]] = row[j + 1];
    });
    fs.writeFileSync(`${LangsPath}/${lang}/${file.title}.json`, JSON.stringify(_unflatten(contents), null, 2));
  });
};

const _mergePull = async (file, tmp, localData) => {
  let mergedData = await _mergeData(file, tmp, localData);
  mergedData = mergedData.slice(1);
  Langs.forEach((lang, j) => {
    const contents = {};
    mergedData.forEach(row => {
      contents[row[0]] = row[j + 1];
    });
    fs.writeFileSync(`${LangsPath}/${lang}/${file.title}.json`, JSON.stringify(_unflatten(contents), null, 2));
  });
};

const _overrideOrImportPush = (dataPostRequest, localData) => {
  dataPostRequest
    .resource
    .requests[dataPostRequest.resource.requests.length - 1]
    .pasteData
    .data = localData.map(el => el.join(';')).join('\n');
};

const _mergePush = async (dataPostRequest, file, tmp, localData) => {
  const mergedData = await _mergeData(file, tmp, localData);
  dataPostRequest
    .resource
    .requests[dataPostRequest.resource.requests.length - 1]
    .pasteData
    .data = mergedData.map(el => el.join(';')).join('\n');
};

// inconsistent use of methods
// it`s really bad, please don`t leave it like that
const _commandsDivision = async (localData, file, dataPostRequest, tmp) => {
  const method = process.argv[3] ? process.argv[3][1].toLowerCase() : null;
  switch (process.argv[2]) {
    case 'push':
      if (_.isEmpty(tmp) || method === 'o') await _overrideOrImportPush(dataPostRequest, localData);
      else await _mergePush(dataPostRequest, file, tmp, localData);
      break;
    case 'pull':
      if (localData.length <= 1 || method === 'o') await _overrideOrImportPull(file, tmp);
      else await _mergePull(file, tmp, localData);
      break;
    // case 'diff':
    //   await diff(tmp, localData);
    //   break;
    default:
      break;
  }
};

const _localFiles = () => {
  let files = [];
  Langs.forEach(lang => {
    files.push(fs.readdirSync(`${LangsPath}/${lang}`));
  });
  files = _mergeArrays(files);
  // eslint-disable-next-line no-return-assign
  files.forEach((e, i) => files[i] = e.substr(0, e.lastIndexOf('.')));
  return files;
};

const _remoteFiles = (remoteNames, files) => _.difference(remoteNames, files);

const _remoteOnly = async (remoteSheets, fileName) => {
  const file = remoteSheets.find(e => e.title === fileName);
  const { sheetId } = file;
  const tmp = [];
  const response = await new Promise(resolve => https.get(`https://docs.google.com/spreadsheets/d/${SpreadsheetId}/export?gid=${sheetId}&format=csv&id=${SpreadsheetId}`,
    resolve,
  ));

  await new Promise(resolve => response
    .pipe(csv())
    .on('data', (data) => tmp.push(data))
    .on('end', resolve),
  );

  console.log('\x1b[33m', file.title, '  A');
  const parsedSheet = _parseSheetData(tmp);
  console.log(_.isEmpty(parsedSheet[0]) ? 'empty sheet' : _parseSheetData(tmp));
  console.log('\x1b[0m');
};

const standardizeModules = (languages) => {
  languages.forEach(language => {
    Langs.forEach(lang => {
      const files = fs.readdirSync(`${LangsPath}/${lang}`);
      Object.keys(language).forEach(k => {
        if (!files.includes(k)) {
          fs.writeFileSync(`${LangsPath}/${lang}/${k}`, '{\n}');
        }
      });
    });
  });
};

// refactor (logic)
const _parseTranslations = (i) => {
  const [fileName, ...data] = _standardizeData(i);
  // eslint-disable-next-line arrow-body-style
  const result = data[0].reduce((r, e) => {
    return Object.keys(e).forEach((k) => {
      const key = r.filter(el => !!~el.indexOf(k))[0];
      // eslint-disable-next-line no-unused-expressions
      !key ? r.push([].concat(k).concat(e[k])) : key.push(e[k]);
    // eslint-disable-next-line no-sequences
    }), r;
  }, []);
  result.unshift(Headers);
  return [fileName, ...result];
};


const _cliDiff = (fileName, tmp, localData) => {
  const remoteData = _parseSheetData(tmp);
  console.log('\x1b[36m%s\x1b[0m', fileName);
  remoteData.forEach((row, k) => {
    if (k === 0) {
      process.stdout.write('\x1b[7m', row);
      console.log('\x1b[0m');
    }
    if (!localData.find(el => el[0] === row[0])) {
      process.stdout.write('\x1b[7m');
      if (row[0]) process.stdout.write(`[${row.map(e => `'${e}'`)}]  A`);
      else process.stdout.write('[]  A');
      console.log('\x1b[0m');
    } else {
      process.stdout.write(`['${row[0]}'`);
      row.slice(1).forEach((tran, j) => {
        if (tran !== localData.find(el => el[0] === row[0])[j + 1]) {
          process.stdout.write(',');
          process.stdout.write('\x1b[7m');
          process.stdout.write(`'${tran}'`);
          process.stdout.write('\x1b[0m');
        } else {
          process.stdout.write('\x1b[0m');
          process.stdout.write(`,'${tran}'`);
        }
      });
      process.stdout.write(']');
      console.log();
    }
  });
  console.log();
};


const _sharedFiles = async (remoteSheets, i) => {
  const [fileName, ...localData] = _parseTranslations(i);

  const file = remoteSheets.find(e => e.title === fileName);
  const { sheetId } = file;
  const tmp = [];
  const response = await new Promise(resolve => https.get(`https://docs.google.com/spreadsheets/d/${SpreadsheetId}/export?gid=${sheetId}&format=csv&id=${SpreadsheetId}`,
    resolve,
  ));

  await new Promise(resolve => response
    .pipe(csv())
    .on('data', (data) => tmp.push(data))
    .on('end', resolve),
  );

  _cliDiff(fileName, tmp, localData);
};

const diff = (remoteSheets) => {
  const localFiles = _localFiles();
  const remoteNames = remoteSheets.map(e => e.title);
  const remoteOnlyFiles = _remoteFiles(remoteNames, localFiles);

  remoteOnlyFiles.forEach(async fileName => {
    _remoteOnly(remoteSheets, fileName);
  });

  const sharedFiles = _.intersection(remoteNames, localFiles);

  sharedFiles.forEach(async (f, i) => {
    _sharedFiles(remoteSheets, i);
  });
};

const prepareData = async (file, i, dataPostRequest = null) => {
  const { sheetId } = file;
  const [, ...localData] = _parseTranslations(i);
  const tmp = [];
  const response = await new Promise(resolve => https.get(`https://docs.google.com/spreadsheets/d/${SpreadsheetId}/export?gid=${sheetId}&format=csv&id=${SpreadsheetId}`,
    resolve,
  ));

  await new Promise(resolve => response
    .pipe(csv())
    .on('data', (data) => tmp.push(data))
    .on('end', resolve),
  );

  await _commandsDivision(localData, file, dataPostRequest, tmp);
};

const largestSubDirFilesCount = (path) => {
  let maxLength = 0;
  Langs.forEach(lang => {
    if (fs.readdirSync(`${path}/${lang}`).length > maxLength) {
      maxLength = fs.readdirSync(`${path}/${lang}`).length;
    }
  });
  return maxLength;
};

const languages = () => {
  const folds = [];
  Langs.forEach((lang, j) => {
    const files = fs.readdirSync(`${LangsPath}/${lang}`);
    const modules = {};
    files.forEach((file) => {
      modules[file] = true;
    });
    folds[j] = modules;
  });

  folds.forEach(foldsOut => {
    folds.forEach(foldsIn => {
      foldsOut = { ...foldsOut, ...foldsIn };
    });
  });

  return folds;
};

const createFiles = (sheetNames, i) => {
  sheetNames.map(el => (!fs.existsSync(`${LangsPath}/${Langs[i]}/${el}.json`)
    ? fs.writeFileSync(`${LangsPath}/${Langs[i]}/${el}.json`, '{\n}')
    : null));
};

const deleteFiles = (sheetNames, i) => {
  // TODO: (WARN  HERE)
  const modules = fs.readdirSync(`${LangsPath}/${Langs[i]}`);
  const removedOnRemoteFiles = modules.filter(el => !sheetNames.includes(el.substr(0, el.lastIndexOf('.'))));
  if (!!removedOnRemoteFiles) removedOnRemoteFiles.forEach(file => fs.unlinkSync(`${LangsPath}/${Langs[i]}/${file}`));
};

const setRequestsAuth = (
  getRequest,
  sheetRequest,
  dataPostRequest,
  dataRemoveRequest,
  authClient,
) => {
  getRequest.auth = authClient;
  sheetRequest.auth = authClient;
  dataPostRequest.auth = authClient;
  dataRemoveRequest.auth = authClient;
};

const formAddSheetRequests = (sheetRequest, response) => {
  const iterNum = largestSubDirFilesCount(LangsPath);
  for (let i = 0; i < iterNum; i++) {
    const [fileName] = _parseTranslations(i);
    FileNames.push(fileName.toString());
    if (!response.data.sheets.map(el => el.properties.title).includes(FileNames[i])) {
      sheetRequest.resource.requests.push({
        addSheet: {
          properties: {
            title: FileNames[i],
          },
        },
      });
    }
  }
};

const formDeleteSheetRequests = (sheetRequest, response) => {
  const sheetsProps = response.data.sheets.map(el => el.properties);
  const diffs = sheetsProps.map(el => el.title).filter(e => !FileNames.includes(e));
  diffs.forEach(row => {
    // TODO: cli => ask if to keep (WARN HERE)
    sheetRequest.resource.requests.push({
      deleteSheet: {
        sheetId: sheetsProps.find(el => el.title === row).sheetId,
      },
    });
  });
};

const formRequestsForPush = (dataRemoveRequest, dataPostRequest, sheetID) => {
  dataRemoveRequest.resource.requests.push({
    updateCells: {
      range: {
        sheetId: sheetID,
      },
      fields: 'userEnteredValue',
    },
  });

  dataPostRequest.resource.requests.push({
    pasteData: {
      coordinate: {
        sheetId: sheetID,
        rowIndex: 0,
        columnIndex: 0,
      },
      data: '',
      type: 'PASTE_NORMAL',
      delimiter: ';',
    },
  });
};

module.exports = {
  SpreadsheetId,
  FileNames,
  Langs,
  Headers,
  LangsPath,
  languages,
  largestSubDirFilesCount,
  createFiles,
  deleteFiles,
  setRequestsAuth,
  formAddSheetRequests,
  formDeleteSheetRequests,
  formRequestsForPush,
  prepareData,
  standardizeModules,
  diff,
};
