
// ============================================================================
// CODE AST — lightweight structural analysis of plugin modules
//
// Derives an AST-like map from source code so the orchestrator can reason
// about code structure without parsing the full TypeScript AST. Tracks:
//   - Named exports (functions, constants, types)
//   - Default export
//   - Section markers (// === SECTION_NAME ===)
//   - Import ranges
//
// The AST is cached in job state after each edit and re-derived on read.
// ============================================================================

export interface ExportInfo {
  name: string;
  type: 'function' | 'const' | 'type' | 'interface' | 'default';
  /** 1-based line range [start, end] inclusive */
  lines: [number, number];
}

export interface SectionInfo {
  name: string;
  /** 1-based line range [start, end] inclusive */
  lines: [number, number];
}

export interface FileAST {
  totalLines: number;
  imports: { lines: [number, number] } | null;
  exports: ExportInfo[];
  sections: SectionInfo[];
}

export interface PluginAST {
  files: Record<string, FileAST>;
}

// ─── Extract named exports ──────────────────────────────────────────────────

function extractExports(code: string): ExportInfo[] {
  const lines = code.split('\n');
  const exports: ExportInfo[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // export default function Name(...)
    let m = line.match(/^export\s+default\s+function\s+(\w+)/);
    if (m) {
      const end = findFunctionEnd(lines, i);
      exports.push({ name: m[1], type: 'default', lines: [i + 1, end + 1] });
      continue;
    }

    // export function Name(...)
    m = line.match(/^export\s+function\s+(\w+)/);
    if (m) {
      const end = findFunctionEnd(lines, i);
      exports.push({ name: m[1], type: 'function', lines: [i + 1, end + 1] });
      continue;
    }

    // export default ...
    m = line.match(/^export\s+default\s+/);
    if (m && !line.includes('function')) {
      exports.push({ name: 'default', type: 'default', lines: [i + 1, i + 1] });
      continue;
    }

    // export const/let/var Name
    m = line.match(/^export\s+(?:const|let|var)\s+(\w+)/);
    if (m) {
      const end = findConstEnd(lines, i);
      exports.push({ name: m[1], type: 'const', lines: [i + 1, end + 1] });
      continue;
    }

    // export type/interface Name
    m = line.match(/^export\s+(?:type|interface)\s+(\w+)/);
    if (m) {
      const end = findBlockEnd(lines, i);
      exports.push({ name: m[1], type: line.includes('interface') ? 'interface' : 'type', lines: [i + 1, end + 1] });
      continue;
    }
  }

  return exports;
}

// ─── Extract section markers ────────────────────────────────────────────────

function extractSections(code: string): SectionInfo[] {
  const lines = code.split('\n');
  const markers: { name: string; lineIndex: number }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/\/\/\s*={3,}\s*(.+?)\s*={3,}/);
    if (m) {
      markers.push({ name: m[1].trim(), lineIndex: i });
    }
  }

  const sections: SectionInfo[] = [];
  for (let i = 0; i < markers.length; i++) {
    const start = markers[i].lineIndex;
    const end = i + 1 < markers.length ? markers[i + 1].lineIndex - 1 : lines.length - 1;
    sections.push({ name: markers[i].name, lines: [start + 1, end + 1] });
  }

  return sections;
}

// ─── Extract import range ───────────────────────────────────────────────────

function extractImportsRange(code: string): { lines: [number, number] } | null {
  const lines = code.split('\n');
  let firstImport = -1;
  let lastImport = -1;

  for (let i = 0; i < lines.length; i++) {
    if (/^import\s/.test(lines[i].trim())) {
      if (firstImport === -1) firstImport = i;
      lastImport = i;
    }
  }

  if (firstImport === -1) return null;
  return { lines: [firstImport + 1, lastImport + 1] };
}

// ─── Helpers — find end of blocks ───────────────────────────────────────────

function findFunctionEnd(lines: string[], startLine: number): number {
  let depth = 0;
  let foundOpen = false;
  for (let i = startLine; i < lines.length; i++) {
    for (const ch of lines[i]) {
      if (ch === '{') { depth++; foundOpen = true; }
      if (ch === '}') depth--;
    }
    if (foundOpen && depth === 0) return i;
  }
  return lines.length - 1;
}

function findConstEnd(lines: string[], startLine: number): number {
  // Arrow functions: const X = (...) => { ... }
  const line = lines[startLine];
  if (line.includes('=>') && line.includes('{')) {
    return findFunctionEnd(lines, startLine);
  }
  // Multi-line const ending with semicolon
  for (let i = startLine; i < lines.length; i++) {
    if (lines[i].trimEnd().endsWith(';')) return i;
  }
  return startLine;
}

function findBlockEnd(lines: string[], startLine: number): number {
  let depth = 0;
  let foundOpen = false;
  for (let i = startLine; i < lines.length; i++) {
    for (const ch of lines[i]) {
      if (ch === '{') { depth++; foundOpen = true; }
      if (ch === '}') depth--;
    }
    if (foundOpen && depth === 0) return i;
  }
  // Type aliases without braces end at semicolon
  for (let i = startLine; i < lines.length; i++) {
    if (lines[i].includes(';')) return i;
  }
  return lines.length - 1;
}

// ─── Main entry ─────────────────────────────────────────────────────────────

export function deriveAST(modules: Record<string, string>): PluginAST {
  const ast: PluginAST = { files: {} };
  for (const [path, code] of Object.entries(modules)) {
    const lines = code.split('\n');
    ast.files[path] = {
      totalLines: lines.length,
      imports: extractImportsRange(code),
      exports: extractExports(code),
      sections: extractSections(code),
    };
  }
  return ast;
}

/** Derive AST for a single file (convenience wrapper). */
export function deriveFileAST(code: string): FileAST {
  return deriveAST({ 'file': code }).files['file'];
}
