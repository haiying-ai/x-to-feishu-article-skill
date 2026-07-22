#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const codexHome = process.env.CODEX_HOME
  ? path.resolve(process.env.CODEX_HOME)
  : path.join(os.homedir(), '.codex');
const configDir = path.join(codexHome, 'x-to-feishu-article');
const configPath = path.join(configDir, 'config.json');

function parseFolder(value) {
  const input = String(value || '').trim();
  const urlMatch = input.match(/^https:\/\/[^/]+\/(?:drive\/)?folder\/([A-Za-z0-9_-]+)(?:[/?#].*)?$/i);
  const tokenMatch = input.match(/^[A-Za-z0-9_-]{10,}$/);
  if (!urlMatch && !tokenMatch) {
    throw new Error('Provide a Feishu Drive folder URL or folder token');
  }
  return {
    folderToken: urlMatch ? urlMatch[1] : input,
    folderUrl: urlMatch ? input.split(/[?#]/)[0] : null,
    configuredAt: new Date().toISOString()
  };
}

const arg = process.argv[2];
if (!arg || arg === '--show') {
  if (!fs.existsSync(configPath)) {
    console.log(JSON.stringify({ configured: false, configPath }, null, 2));
    process.exit(arg ? 1 : 2);
  }
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  console.log(JSON.stringify({ configured: true, configPath, ...config }, null, 2));
  process.exit(0);
}

if (arg === '--clear') {
  if (fs.existsSync(configPath)) fs.unlinkSync(configPath);
  console.log(JSON.stringify({ configured: false, cleared: true, configPath }, null, 2));
  process.exit(0);
}

const config = parseFolder(arg);
fs.mkdirSync(configDir, { recursive: true });
fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 });
console.log(JSON.stringify({ configured: true, configPath, ...config }, null, 2));

