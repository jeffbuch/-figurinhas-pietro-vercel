const { google } = require('googleapis');

const REQUIRED_ENV = [
  'GOOGLE_SHEET_ID',
  'GOOGLE_CLIENT_EMAIL',
  'GOOGLE_PRIVATE_KEY',
  'SHEET_NAME'
];

function assertEnv() {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`Variáveis ausentes na Vercel: ${missing.join(', ')}`);
  }
}

function getAuth() {
  assertEnv();

  const privateKey = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');

  return new google.auth.JWT({
    email: process.env.GOOGLE_CLIENT_EMAIL,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
}

function getSheetsClient() {
  const auth = getAuth();
  return google.sheets({ version: 'v4', auth });
}

function sheetName() {
  return process.env.SHEET_NAME || 'Controle';
}

function sheetId() {
  return process.env.GOOGLE_SHEET_ID;
}

function normalizeHeader(header) {
  return String(header || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

function columnIndexToLetter(index) {
  let letter = '';
  let n = index + 1;

  while (n > 0) {
    const rem = (n - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    n = Math.floor((n - 1) / 26);
  }

  return letter;
}

function normalizeCode(v) {
  return String(v || '').trim().toUpperCase().replace(/\s+/g, '');
}

async function getRows() {
  const sheets = getSheetsClient();
  const range = `${sheetName()}!A:Z`;

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId(),
    range
  });

  const values = response.data.values || [];
  const headers = values[0] || [];

  const headerMap = {};
  headers.forEach((h, index) => {
    headerMap[normalizeHeader(h)] = index;
  });

  const aliases = {
    grupo: ['grupo'],
    pais: ['pais/secao', 'pais/seção', 'pais', 'seção', 'secao'],
    sigla: ['sigla'],
    numero: ['numero', 'número', 'num'],
    codigo: ['codigo', 'código', 'code'],
    status: ['status'],
    repetidas: ['repetidas', 'repetida'],
    observacoes: ['observacoes', 'observações', 'obs']
  };

  function idx(name) {
    const names = aliases[name].map(normalizeHeader);
    for (const n of names) {
      if (headerMap[n] !== undefined) return headerMap[n];
    }
    return -1;
  }

  const columns = {
    grupo: idx('grupo'),
    pais: idx('pais'),
    sigla: idx('sigla'),
    numero: idx('numero'),
    codigo: idx('codigo'),
    status: idx('status'),
    repetidas: idx('repetidas'),
    observacoes: idx('observacoes')
  };

  if (columns.codigo === -1) {
    throw new Error('Coluna Código não encontrada na primeira linha da planilha.');
  }

  const rows = values.slice(1).map((row, i) => {
    const read = (key) => columns[key] >= 0 ? (row[columns[key]] || '') : '';

    return {
      rowNumber: i + 2,
      grupo: read('grupo'),
      pais: read('pais'),
      sigla: read('sigla'),
      numero: read('numero'),
      codigo: normalizeCode(read('codigo')),
      status: read('status') || 'Falta',
      repetidas: Number(read('repetidas') || 0),
      observacoes: read('observacoes')
    };
  }).filter((row) => row.codigo);

  return { rows, headers, columns };
}

async function updateCell(rowNumber, columnIndex, value) {
  if (columnIndex < 0) return;

  const sheets = getSheetsClient();
  const col = columnIndexToLetter(columnIndex);
  const range = `${sheetName()}!${col}${rowNumber}`;

  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId(),
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[value]]
    }
  });
}

async function batchUpdateCells(updates) {
  if (!updates.length) return;

  const sheets = getSheetsClient();

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: sheetId(),
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data: updates
    }
  });
}

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

module.exports = {
  getRows,
  updateCell,
  batchUpdateCells,
  normalizeCode,
  sendJson,
  sheetName
};
