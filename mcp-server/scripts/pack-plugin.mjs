#!/usr/bin/env node
/**
 * Pack a plugin folder → JSON for create_plugin / validate_plugin.
 *
 * Usage:
 *   node mcp-server/scripts/pack-plugin.mjs ./path/to/plugin
 *   node mcp-server/scripts/pack-plugin.mjs ./path/to/plugin --out packed.json
 *
 * Use when HTTP MCP cannot read your disk: pack locally, then call create_plugin with the JSON.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');

// Load pack via tsx-compatible dynamic import of compiled-ish source through tsx if available
async function loadPack() {
  const modPath = path.join(root, 'src/lib/mcp/pack-plugin-dir.ts');
  try {
    const mod = await import(pathToFileURL(modPath).href);
    return mod.packPluginDir;
  } catch {
    // Fallback: minimal packer inline (no TS path) — duplicate walk logic
    return null;
  }
}

function walkInline(dir, base, out) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (['node_modules', 'dist', 'build', '.git'].includes(ent.name)) continue;
      walkInline(abs, base, out);
    } else if (ent.isFile()) {
      out.push(abs);
    }
  }
}

function packInline(dirPath) {
  const resolved = path.resolve(dirPath);
  const files = [];
  walkInline(resolved, resolved, files);
  const modules = {};
  let packageJson = null;
  let schema_json = JSON.stringify({ properties: {}, defaults: {} });
  let pluginMeta = {};
  for (const abs of files) {
    const rel = path.relative(resolved, abs).split(path.sep).join('/');
    const base = path.basename(abs);
    if (['package-lock.json', 'yarn.lock', 'tsconfig.json'].includes(base)) continue;
    if (base.startsWith('.')) continue;
    const content = fs.readFileSync(abs, 'utf-8');
    if (base === 'package.json') {
      packageJson = JSON.parse(content);
      continue;
    }
    if (base === 'schema.json') {
      schema_json = content;
      continue;
    }
    if (base === 'plugin.json') {
      pluginMeta = JSON.parse(content);
      continue;
    }
    const ext = path.extname(base);
    if (!['.tsx', '.ts', '.jsx', '.js', '.css'].includes(ext)) continue;
    modules[rel === 'index.tsx' ? 'Scene.tsx' : rel] = content;
  }
  if (!modules['Scene.tsx']) throw new Error('Missing Scene.tsx');
  const dependencies = { ...(packageJson?.dependencies || {}) };
  const id = pluginMeta.id || path.basename(resolved);
  const name = pluginMeta.name || id;
  return {
    success: true,
    create_plugin_args: {
      id,
      name,
      description: pluginMeta.description || packageJson?.description || '',
      category: pluginMeta.category || 'content',
      scene_code: modules['Scene.tsx'],
      modules,
      schema_json,
      dependencies,
    },
    files: Object.keys(modules),
  };
}

const args = process.argv.slice(2);
const dir = args.find((a) => !a.startsWith('--'));
const outIdx = args.indexOf('--out');
const outFile = outIdx >= 0 ? args[outIdx + 1] : null;

if (!dir) {
  console.error('Usage: node pack-plugin.mjs <plugin-dir> [--out packed.json]');
  process.exit(1);
}

let packPluginDir = await loadPack();
let result;
if (packPluginDir) {
  result = packPluginDir(dir);
} else {
  result = packInline(dir);
}

const json = JSON.stringify(result, null, 2);
if (outFile) {
  fs.writeFileSync(outFile, json, 'utf-8');
  console.error(`Wrote ${outFile} (${result.files?.length ?? 0} modules)`);
} else {
  console.log(json);
}
