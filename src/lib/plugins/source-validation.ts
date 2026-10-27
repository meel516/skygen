export interface PluginSourceValidationIssue {
  file: string;
  line: number;
  message: string;
}

export interface PluginSourceValidationResult {
  ok: boolean;
  issues: PluginSourceValidationIssue[];
}

const RESERVED_DATA_FIELDS = new Set(['animation', 'theme', 'motionProfile']);

function lineNumberForIndex(source: string, index: number): number {
  return source.slice(0, Math.max(0, index)).split(/\r\n|\r|\n/).length;
}

function addRegexIssues(
  issues: PluginSourceValidationIssue[],
  file: string,
  source: string,
  pattern: RegExp,
  message: string,
) {
  for (const match of source.matchAll(pattern)) {
    issues.push({
      file,
      line: lineNumberForIndex(source, match.index ?? 0),
      message,
    });
  }
}

export function validatePluginSource(
  files: Record<string, string>,
): PluginSourceValidationResult {
  const issues: PluginSourceValidationIssue[] = [];

  for (const [file, source] of Object.entries(files)) {
    addRegexIssues(
      issues,
      file,
      source,
      /\bdata\s*\.\s*animation\s*(?:[?.]\s*)?\.\s*(?:enter|hold|exit)\b/g,
      'Do not read animation timing from data.animation. The Scene receives animation as its own prop; use animation.enter, animation.hold, or animation.exit.',
    );

    addRegexIssues(
      issues,
      file,
      source,
      /\bdata\s*\.\s*animation\b(?!\s*(?:[?.]\s*)?\.)/g,
      'Do not read animation from plugin data. animation is a reserved Scene prop, not a schema/data field.',
    );

    addRegexIssues(
      issues,
      file,
      source,
      /\b(?:const|let|var)\s*\{[^}]*\banimation\b[^}]*\}\s*=\s*data\b/g,
      'Do not destructure animation from data. Destructure animation from Scene props instead.',
    );

    addRegexIssues(
      issues,
      file,
      source,
      /\b(?:const|let|var)\s+animation\s*=\s*data\b/g,
      'Do not assign animation from data. animation is passed separately to Scene.',
    );
  }

  return { ok: issues.length === 0, issues };
}

export function validatePluginSchemaReservedFields(
  schemaJson: string | Record<string, unknown>,
): PluginSourceValidationResult {
  const issues: PluginSourceValidationIssue[] = [];
  let schema: any;

  try {
    schema = typeof schemaJson === 'string' ? JSON.parse(schemaJson) : schemaJson;
  } catch {
    return { ok: true, issues };
  }

  const properties = schema?.properties;
  if (!properties || typeof properties !== 'object' || Array.isArray(properties)) {
    return { ok: true, issues };
  }

  for (const fieldName of Object.keys(properties)) {
    if (RESERVED_DATA_FIELDS.has(fieldName)) {
      issues.push({
        file: 'schema.json',
        line: 1,
        message: `"${fieldName}" is reserved by the host Scene props and cannot be a plugin data field.`,
      });
    }
  }

  return { ok: issues.length === 0, issues };
}

export function formatPluginSourceIssues(issues: PluginSourceValidationIssue[]): string {
  return issues.map((issue) => `${issue.file}:${issue.line} ${issue.message}`).join('\n');
}
