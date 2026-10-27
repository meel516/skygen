// ============================================================================
// PLUGIN TEMPLATE DOWNLOAD
// GET /api/plugins/template — returns plugin-template/ as a downloadable ZIP
// ============================================================================

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

/** Recursively collect all files under a directory */
function collectFiles(dir: string, base: string): Array<{ relativePath: string; content: Buffer }> {
  const results: Array<{ relativePath: string; content: Buffer }> = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.join(base, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFiles(fullPath, relativePath));
    } else {
      results.push({ relativePath, content: fs.readFileSync(fullPath) });
    }
  }
  return results;
}

/** Build a simple ZIP in memory using the ZIP format spec (no deps needed) */
function buildZip(files: Array<{ relativePath: string; content: Buffer }>): Buffer {
  // We use Bun's built-in zip support via shell: write files to tmp dir,
  // zip them, read zip, return it.
  const tmpDir = fs.mkdtempSync(path.join(process.cwd(), 'tmp-template-'));

  try {
    for (const file of files) {
      const dest = path.join(tmpDir, file.relativePath);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, file.content);
    }

    const zipPath = path.join(tmpDir, '..', `plugin-template-${Date.now()}.zip`);

    let result = spawnSync('zip', ['-r', zipPath, 'my-plugin'], { cwd: tmpDir });

    // Fallback to PowerShell on Windows
    if ((result.status ?? 1) !== 0 && process.platform === 'win32') {
      result = spawnSync('powershell', [
        '-NoProfile', '-Command',
        `Compress-Archive -Path "${path.join(tmpDir, 'my-plugin')}" -DestinationPath "${zipPath}" -Force`,
      ]);
    }

    if ((result.status ?? 1) !== 0) {
      throw new Error('zip failed');
    }

    const zipBuffer = fs.readFileSync(zipPath);
    fs.unlinkSync(zipPath);
    return zipBuffer;
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
}

export async function GET() {
  try {
    const templateDir = path.join(process.cwd(), 'plugin-template');

    if (!fs.existsSync(templateDir)) {
      return NextResponse.json({ error: 'Plugin template not found on server' }, { status: 404 });
    }

    const files = collectFiles(templateDir, 'my-plugin');
    const zipBuffer = buildZip(files);

    return new NextResponse(zipBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="plugin-template.zip"',
        'Content-Length': String(zipBuffer.length),
      },
    });
  } catch (error) {
    console.error('Template download failed:', error);
    return NextResponse.json({ error: 'Failed to generate template ZIP' }, { status: 500 });
  }
}
