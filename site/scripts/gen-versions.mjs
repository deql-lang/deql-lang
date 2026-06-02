#!/usr/bin/env node
/**
 * gen-versions.mjs — Generate public/versions.json from astro.config.mjs sidebar.
 *
 * Runs automatically via prebuild/predev npm hooks.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = join(__dirname, '..');
const ASTRO_CONFIG = join(SITE_ROOT, 'astro.config.mjs');
const OUTPUT = join(SITE_ROOT, 'public', 'versions.json');

const config = readFileSync(ASTRO_CONFIG, 'utf8');

// Find the Versions section and extract items
const versionsMatch = config.match(/label:\s*['"]Versions['"][^}]*items:\s*\[([\s\S]*?)\]/);

const versions = [];

if (versionsMatch) {
  const itemsBlock = versionsMatch[1];
  // Match each { label: '...', link: '...' }
  const entryRegex = /label:\s*['"]([^'"]+)['"].*?link:\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = entryRegex.exec(itemsBlock)) !== null) {
    versions.push({ label: m[1], value: m[2].replace(/\//g, '').replace(/^deql-lang/, '') });
  }
}

const output = {
  versions: [
    { label: 'latest', value: '' },
    ...versions,
  ],
};

writeFileSync(OUTPUT, JSON.stringify(output, null, 2) + '\n');
console.log(`Generated versions.json with ${versions.length} version(s)`);
