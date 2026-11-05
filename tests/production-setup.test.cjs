const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('production setup refuses a nonempty spreadsheet before writing', () => {
  const properties = new Map([['PRODUCTION_DATABASE_ID', 'existing-sheet']]);
  let released = false;
  const sheet = {getLastRow: () => 1, getLastColumn: () => 1};
  const ctx = vm.createContext({
    LockService: {getScriptLock: () => ({waitLock() {}, releaseLock() { released = true; }})},
    PropertiesService: {getScriptProperties: () => ({getProperty: key => properties.get(key), setProperty: (key, value) => properties.set(key, value)})},
    Session: {getEffectiveUser: () => ({getEmail: () => 'owner@example.com'})},
    SpreadsheetApp: {openById: id => { assert.equal(id, 'existing-sheet'); return {getSheets: () => [sheet]}; }}
  });
  vm.runInContext(fs.readFileSync('apps-script/ProductionSetup.gs', 'utf8'), ctx);
  assert.throws(() => ctx.setupProductionDatabase_(), /must be empty/);
  assert.equal(properties.has('DATABASE_ID'), false);
  assert.equal(released, true);
});
