function validateSetting(key: string, property: Record<string, any>, value: unknown, depth = 0): void {
  if (depth > 20) throw new Error(`${key} is nested too deeply.`);
  const type = property.type;
  const valid = type === 'number' ? typeof value === 'number' && Number.isFinite(value)
    : type === 'integer' ? typeof value === 'number' && Number.isInteger(value)
    : type === 'array' ? Array.isArray(value)
    : type === 'object' ? value !== null && typeof value === 'object' && !Array.isArray(value)
    : type ? typeof value === type : true;
  if (!valid) throw new Error(`Invalid value for ${key}.`);
  if (property.enum && !property.enum.includes(value)) throw new Error(`Choose a supported value for ${key}.`);
  if (typeof value === 'number' && (
    (property.minimum !== undefined && value < property.minimum) ||
    (property.maximum !== undefined && value > property.maximum)
  )) throw new Error(`${key} is outside the allowed range.`);
  if (typeof value === 'string' && (
    (property.minLength !== undefined && value.length < property.minLength) ||
    (property.maxLength !== undefined && value.length > property.maxLength)
  )) throw new Error(`${key} has an invalid length.`);
  if (Array.isArray(value)) {
    if ((property.minItems !== undefined && value.length < property.minItems) ||
        (property.maxItems !== undefined && value.length > property.maxItems)) throw new Error(`${key} has an invalid number of items.`);
    if (property.items) value.forEach((item, i) => validateSetting(`${key}[${i}]`, property.items, item, depth + 1));
  } else if (value && typeof value === 'object' && property.properties) {
    for (const [childKey, child] of Object.entries(value)) {
      if (Object.hasOwn(property.properties, childKey)) validateSetting(`${key}.${childKey}`, property.properties[childKey], child, depth + 1);
    }
  }
}

/** Update data defaults without changing a plugin's field definitions or source. */
export function updateDraftSettings(schemaJson: string, changes: Record<string, unknown>): string {
  const schema = JSON.parse(schemaJson);
  if (!schema || typeof schema !== 'object' || !schema.properties) {
    throw new Error('This plugin has no editable fields.');
  }
  const defaults = {
    ...Object.fromEntries(Object.entries<any>(schema.properties).filter(([, property]) => property.default !== undefined).map(([key, property]) => [key, property.default])),
    ...schema.defaults,
  };
  for (const [key, value] of Object.entries(changes)) {
    if (['__proto__', 'constructor', 'prototype'].includes(key) || !Object.hasOwn(schema.properties, key)) {
      throw new Error(`Unknown plugin field: ${key}`);
    }
    validateSetting(key, schema.properties[key], value);
    defaults[key] = value;
  }
  return JSON.stringify({ ...schema, defaults });
}
