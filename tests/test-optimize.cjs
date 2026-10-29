const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const scriptPath = path.join(__dirname, '..', 'service', 'optimize.sh');

test('optimize.sh exists and contains valid syntax', () => {
  assert.ok(fs.existsSync(scriptPath), 'service/optimize.sh must exist');
  const content = fs.readFileSync(scriptPath, 'utf8');
  assert.ok(content.startsWith('#!/bin/sh'), 'Must be a POSIX sh script');
});

test('optimize.sh strictly excludes prohibited system units', () => {
  const content = fs.readFileSync(scriptPath, 'utf8');
  const codeOnly = content.split('\n').filter(l => !l.trim().startsWith('#')).join('\n');
  assert.ok(!codeOnly.includes('sdx'), 'Must never target SDX (Settings UI dependency)');
  assert.ok(!codeOnly.includes('ss.gateway'), 'Must never target ss.gateway (DIAL casting dependency)');
  assert.ok(!codeOnly.includes('connman'), 'Must never interfere with ConnMan daemon');
});

test('optimize.sh targets safe-tier debloat units and preload policy', () => {
  const content = fs.readFileSync(scriptPath, 'utf8');
  assert.ok(content.includes('youtube.leanback.v4'), 'Must target YouTube preload');
  assert.ok(content.includes('com.webos.app.lgchannels'), 'Must target LG Channels preload');
  assert.ok(content.includes('service-logger.service'), 'Must stop service-logger');
  assert.ok(content.includes('ai-inference-manager.service'), 'Must stop ai-inference-manager');
  assert.ok(content.includes('homePromotion'), 'Must suppress home promotion');
});

test('optimize.sh supports on and off actions', () => {
  const content = fs.readFileSync(scriptPath, 'utf8');
  assert.ok(content.includes('ACTION="${1:-on}"'), 'Must default to on');
  assert.ok(content.includes('elif [ "$ACTION" = "off" ]; then'), 'Must support off');
});
