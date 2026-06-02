#!/usr/bin/env node
/**
 * promote.mjs — Freeze current docs as a named version.
 *
 * Usage:
 *   npm run promote -- --version=X.Y.Z
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync, copyFileSync } from 'node:fs';
import { join, dirname, basename, extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = join(__dirname, '..');
const DOCS_ROOT = join(SITE_ROOT, 'src', 'content', 'docs');
const ASTRO_CONFIG = join(SITE_ROOT, 'astro.config.mjs');

// ─── Argument Parsing ────────────────────────────────────────────────────────

const versionArg = process.argv.find(a => a.startsWith('--version='));
if (!versionArg) {
  console.error('Usage: npm run promote -- --version=X.Y.Z');
  process.exit(1);
}

const version = versionArg.split('=')[1];
if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error(`Error: Invalid version format "${version}". Expected X.Y.Z (e.g. 0.2.0)`);
  process.exit(1);
}

// ─── Folder Derivation ───────────────────────────────────────────────────────

const folderName = `v${version.replace(/\./g, '-')}`;
const versionDir = join(DOCS_ROOT, folderName);

// ─── Idempotency Guard ───────────────────────────────────────────────────────

if (existsSync(versionDir)) {
  console.error(`Error: Version folder "${folderName}" already exists. Cannot overwrite frozen versions.`);
  process.exit(1);
}

console.log(`\nPromoting current docs to v${version}...`);
mkdirSync(versionDir, { recursive: true });

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isVersionFolder(name) {
  return /^v\d+-\d+-\d+$/.test(name);
}

function isDocFile(name) {
  const ext = extname(name).toLowerCase();
  return ext === '.md' || ext === '.mdx';
}

function copyDirRecursive(src, dest) {
  let count = 0;
  if (!existsSync(dest)) mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src)) {
    const srcPath = join(src, entry);
    const destPath = join(dest, entry);
    const stat = statSync(srcPath);
    if (stat.isDirectory()) {
      count += copyDirRecursive(srcPath, destPath);
    } else if (isDocFile(entry)) {
      copyFileSync(srcPath, destPath);
      count++;
    }
  }
  return count;
}

// ─── Content Cloning ─────────────────────────────────────────────────────────

const copiedRootFiles = [];
for (const entry of readdirSync(DOCS_ROOT)) {
  const fullPath = join(DOCS_ROOT, entry);
  const stat = statSync(fullPath);
  if (stat.isDirectory()) continue; // handle dirs separately
  if (entry === 'index.mdx') continue; // exclude home page
  if (!isDocFile(entry)) continue;
  copyFileSync(fullPath, join(versionDir, entry));
  copiedRootFiles.push(entry);
}
console.log(`  Copied:  ${copiedRootFiles.join(', ')}`);

// Clone concepts/
const conceptsCount = copyDirRecursive(join(DOCS_ROOT, 'concepts'), join(versionDir, 'concepts'));
console.log(`  Copied:  concepts/ (${conceptsCount} files)`);

// Clone examples/
const examplesCount = copyDirRecursive(join(DOCS_ROOT, 'examples'), join(versionDir, 'examples'));
console.log(`  Copied:  examples/ (${examplesCount} files)`);

// Clone rest-api/
const restApiSrc = join(DOCS_ROOT, 'rest-api');
if (existsSync(restApiSrc)) {
  const restApiCount = copyDirRecursive(restApiSrc, join(versionDir, 'rest-api'));
  console.log(`  Copied:  rest-api/ (${restApiCount} files)`);
}
// ─── Index Page Generation ───────────────────────────────────────────────────

function generateIndex() {
  const lines = [
    '---',
    `title: "v${version} Documentation"`,
    `description: "Frozen documentation snapshot for DeQL v${version}"`,
    '---',
    '',
    `# DeQL v${version} Documentation`,
    '',
    `> **You are viewing docs for v${version}.** [Switch to latest](/${getBase()})`,
    '',
    '## Pages',
    '',
  ];

  // Root files
  for (const f of copiedRootFiles) {
    const slug = f.replace(/\.(md|mdx)$/, '');
    const label = slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    lines.push(`- [${label}](/${getBase()}${folderName}/${slug}/)`);
  }

  // Concepts
  lines.push('', '### Concepts', '');
  for (const f of readdirSync(join(versionDir, 'concepts')).filter(isDocFile).sort()) {
    const slug = f.replace(/\.(md|mdx)$/, '');
    const label = slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    lines.push(`- [${label}](/${getBase()}${folderName}/concepts/${slug}/)`);
  }

  // Examples
  lines.push('', '### Examples', '');
  for (const f of readdirSync(join(versionDir, 'examples')).filter(isDocFile).sort()) {
    const slug = f.replace(/\.(md|mdx)$/, '');
    const label = slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    lines.push(`- [${label}](/${getBase()}${folderName}/examples/${slug}/)`);
  }

  // REST API
  if (existsSync(join(versionDir, 'rest-api'))) {
    lines.push('', '### REST API', '');
    for (const f of readdirSync(join(versionDir, 'rest-api')).filter(isDocFile).sort()) {
      const slug = f.replace(/\.(md|mdx)$/, '');
      const label = slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      lines.push(`- [${label}](/${getBase()}${folderName}/rest-api/${slug}/)`);
    }
  }

  writeFileSync(join(versionDir, 'index.md'), lines.join('\n') + '\n');
  console.log(`  Created: ${folderName}/index.md`);
}

function getBase() {
  // Read base from astro config
  const config = readFileSync(ASTRO_CONFIG, 'utf8');
  const match = config.match(/const base\s*=\s*['"]([^'"]+)['"]/);
  if (match) return match[1].replace(/^\//, '');
  return '';
}

generateIndex();

// ─── Version Banner Injection ────────────────────────────────────────────────

function injectBanner(dir) {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      injectBanner(fullPath);
      continue;
    }
    if (!isDocFile(entry)) continue;
    if (entry === 'index.md') continue; // index already has the note

    let content = readFileSync(fullPath, 'utf8');
    const basePath = getBase();
    const bannerHtml = `<span>You are viewing docs for v${version}. <a href="/${basePath}">Switch to latest</a></span>`;

    if (content.startsWith('---')) {
      // Has frontmatter — inject banner field
      const endIdx = content.indexOf('---', 3);
      if (endIdx !== -1) {
        const frontmatter = content.slice(0, endIdx);
        const rest = content.slice(endIdx);
        content = frontmatter + `banner:\n  content: '${bannerHtml}'\n` + rest;
      }
    } else {
      // No frontmatter — add one
      content = `---\nbanner:\n  content: '${bannerHtml}'\n---\n\n` + content;
    }
    writeFileSync(fullPath, content);
  }
}

injectBanner(versionDir);
console.log(`  Injected: version banner into all pages`);

// ─── Import Path Fixing ──────────────────────────────────────────────────────

function fixImports(dir) {
  let fixedCount = 0;
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      fixedCount += fixImports(fullPath);
      continue;
    }
    if (extname(entry).toLowerCase() !== '.mdx') continue;

    let content = readFileSync(fullPath, 'utf8');
    const original = content;
    // Fix relative imports: add one more ../ prefix
    content = content.replace(/(from\s+['"])(\.\.\/)/g, '$1../$2');
    content = content.replace(/(import\s+['"])(\.\.\/)/g, '$1../$2');
    if (content !== original) {
      writeFileSync(fullPath, content);
      fixedCount++;
    }
  }
  return fixedCount;
}

const fixedImports = fixImports(versionDir);
if (fixedImports > 0) {
  console.log(`  Fixed:   ${fixedImports} .mdx import path(s)`);
}

// ─── Sidebar Config Patching ─────────────────────────────────────────────────

function patchSidebar() {
  let config = readFileSync(ASTRO_CONFIG, 'utf8');

  // Look for a Versions section in the sidebar
  const versionsPattern = /(\{[^}]*label:\s*['"]Versions['"][^}]*items:\s*\[)/;
  const match = config.match(versionsPattern);

  if (match) {
    // Insert at the top of the items array
    const insertPoint = match.index + match[0].length;
    const newEntry = `\n\t\t\t\t\t\t{ label: 'v${version}', link: '/${folderName}/' },`;
    config = config.slice(0, insertPoint) + newEntry + config.slice(insertPoint);
  } else {
    // No Versions section found — add one before the closing of the sidebar array
    const sidebarEnd = config.lastIndexOf('],\n\t\t}),');
    if (sidebarEnd !== -1) {
      const versionsSection = `\n\t\t\t\t{\n\t\t\t\t\tlabel: 'Versions',\n\t\t\t\t\titems: [\n\t\t\t\t\t\t{ label: 'v${version}', link: '/${folderName}/' },\n\t\t\t\t\t],\n\t\t\t\t},`;
      config = config.slice(0, sidebarEnd) + versionsSection + '\n\t\t\t' + config.slice(sidebarEnd);
    } else {
      console.warn('  Warning: Could not find sidebar Versions section pattern in astro.config.mjs');
      return;
    }
  }

  writeFileSync(ASTRO_CONFIG, config);
  console.log(`  Updated: astro.config.mjs (sidebar)`);
}

patchSidebar();

// ─── Done ────────────────────────────────────────────────────────────────────

console.log(`\nDone. Version v${version} frozen at /${folderName}/`);
console.log('Build with: cd site && npm run build\n');
