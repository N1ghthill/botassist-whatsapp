#!/usr/bin/env node

const path = require('path');
const helpers = require('./tests/helpers');

let failed = 0;
const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

const suites = [
  'settings.test.js',
  'whatsapp-flow.test.js',
  'electron-main.test.js',
  'release.test.js',
  'security.test.js',
  'tools.test.js',
];

for (const suite of suites) {
  require(path.join(__dirname, 'tests', suite)).register({ test, ...helpers });
}

async function run() {
  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(`ok - ${name}`);
    } catch (err) {
      failed += 1;
      console.error(`not ok - ${name}`);
      console.error(err && err.stack ? err.stack : err);
    }
  }

  if (failed > 0) {
    process.exitCode = 1;
  }
}

run().catch((err) => {
  process.exitCode = 1;
  console.error(err && err.stack ? err.stack : err);
});
