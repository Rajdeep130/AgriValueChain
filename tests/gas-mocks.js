/**
 * gas-mocks.js — a small in-memory imitation of the Google Apps Script
 * services our backend uses, so backend logic can be tested on a laptop.
 * It imitates behaviour; it does NOT prove the real Google services work.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const BACKEND_DIR = path.join(__dirname, '..', 'backend');
const LOAD_ORDER = ['Response.gs', 'Config.gs', 'Database.gs', 'Auth.gs', 'Poc.gs', 'Code.gs'];

/** Imitates how Google Sheets stores typed-in values. */
function storeValue(v) {
  if (typeof v === 'string' && v.startsWith("'")) return v.slice(1); // apostrophe forces text
  if (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v))) return Number(v);
  return v;
}

function makeSheet(name) {
  const rows = [];
  return {
    _rows: rows,
    getName: () => name,
    getDataRange: () => ({ getValues: () => rows.map((r) => r.slice()) }),
    appendRow: (arr) => { rows.push(arr.map(storeValue)); },
    getRange: (row, col, numRows, numCols) => ({
      setValue: (v) => { while (rows.length < row) rows.push([]); rows[row - 1][col - 1] = storeValue(v); },
      setValues: (vals) => {
        vals.forEach((vr, i) => {
          while (rows.length < row + i) rows.push([]);
          vr.forEach((v, j) => { rows[row - 1 + i][col - 1 + j] = storeValue(v); });
        });
      }
    }),
    setFrozenRows: () => {}
  };
}

function makeSpreadsheet(id) {
  const sheets = { Sheet1: makeSheet('Sheet1') };
  return {
    _sheets: sheets,
    getId: () => id,
    getUrl: () => 'https://docs.google.com/spreadsheets/d/' + id,
    getSheetByName: (n) => sheets[n] || null,
    getSheets: () => Object.values(sheets),
    insertSheet: (n) => (sheets[n] = makeSheet(n)),
    deleteSheet: (s) => { delete sheets[s.getName()]; }
  };
}

/**
 * Creates a fresh, isolated backend instance.
 * options.tokens: { tokenString: claimsObject } accepted by fake tokeninfo.
 */
function createBackend(options) {
  const opts = options || {};
  const state = {
    props: Object.assign({}, opts.props || {}),
    cache: {},
    spreadsheets: {},
    fetchCount: 0,
    lockAvailable: true,
    logs: [],
    ownerEmail: opts.ownerEmail || 'owner@example.com',
    tokens: opts.tokens || {}
  };

  const sandbox = {
    console: {
      log: (m) => state.logs.push(['log', String(m)]),
      warn: (m) => state.logs.push(['warn', String(m)]),
      error: (m) => state.logs.push(['error', String(m)])
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => (k in state.props ? state.props[k] : null),
        setProperty: (k, v) => { state.props[k] = v; }
      })
    },
    SpreadsheetApp: {
      create: () => {
        const id = 'ss' + (Object.keys(state.spreadsheets).length + 1);
        return (state.spreadsheets[id] = makeSpreadsheet(id));
      },
      openById: (id) => {
        if (!state.spreadsheets[id]) throw new Error('Spreadsheet not found: ' + id);
        return state.spreadsheets[id];
      }
    },
    LockService: {
      getScriptLock: () => ({ tryLock: () => state.lockAvailable, releaseLock: () => {} })
    },
    CacheService: {
      getScriptCache: () => ({
        get: (k) => (k in state.cache ? state.cache[k] : null),
        put: (k, v) => { state.cache[k] = v; }
      })
    },
    UrlFetchApp: {
      fetch: (url) => {
        state.fetchCount++;
        const token = decodeURIComponent(url.split('id_token=')[1]);
        const claims = state.tokens[token];
        return {
          getResponseCode: () => (claims ? 200 : 400),
          getContentText: () => JSON.stringify(claims || { error: 'invalid_token' })
        };
      }
    },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'sha256' },
      Charset: { UTF_8: 'utf8' },
      computeDigest: (alg, text) => Array.from(crypto.createHash('sha256').update(text, 'utf8').digest()).map((b) => (b > 127 ? b - 256 : b))
    },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (text) => ({ _text: text, setMimeType() { return this; }, getContent() { return this._text; } })
    },
    Session: { getEffectiveUser: () => ({ getEmail: () => state.ownerEmail }) }
  };
  vm.createContext(sandbox);
  LOAD_ORDER.forEach((file) => {
    vm.runInContext(fs.readFileSync(path.join(BACKEND_DIR, file), 'utf8'), sandbox, { filename: file });
  });

  /** Sends a request exactly as doPost would receive it and returns the parsed JSON. */
  function post(body) {
    const contents = typeof body === 'string' ? body : JSON.stringify(body);
    const out = sandbox.doPost({ postData: { contents: contents } });
    return JSON.parse(out.getContent());
  }

  function rows(tableName) {
    const ss = state.spreadsheets[state.props.SPREADSHEET_ID];
    return ss.getSheetByName(tableName)._rows.slice(1);
  }

  return { sandbox, state, post, rows };
}

module.exports = { createBackend };
