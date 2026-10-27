// ============================================================================
// PLUGIN SCHEMA TYPES
// ============================================================================

/**
 * Editor field types for schema properties
 */
export type EditorType = 
  | 'text'
  | 'number'
  | 'textarea'
  | 'select'
  | 'multiselect'
  | 'color'
  | 'slider'
  | 'toggle'
  | 'file'
  | 'image'
  | 'video'
  | 'audio'
  | 'date'
  | 'time'
  | 'datetime'
  | 'json'
  | 'code'
  | 'array'
  | 'object';

/**
 * Editor configuration for advanced field types
 */
export interface EditorConfig {
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  placeholder?: string;
  rows?: number;
  language?: string;  // For code editor
  accept?: string;    // For file inputs
  options?: { label: string; value: string | number }[];
}

/**
 * Schema property definition
 */
export interface SchemaProperty {
  type: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';
  title: string;
  description?: string;
  default?: unknown;
  
  // Editor configuration
  editor?: EditorType;
  editorConfig?: EditorConfig;
  
  // For enum types
  enum?: (string | number)[];
  enumLabels?: Record<string, string>;
  
  // For array types
  items?: SchemaProperty;
  minItems?: number;
  maxItems?: number;
  
  // For object types
  properties?: Record<string, SchemaProperty>;
  required?: string[];
  
  // Validation
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  pattern?: string;
  
  // Conditional visibility
  conditional?: {
    field: string;
    values: unknown[];
  };
  
  // Custom validation
  validation?: {
    custom?: string;  // Custom validation function name
    message?: string;
  };
}

/**
 * UI section for organizing properties in the editor
 */
export interface UISection {
  title: string;
  icon?: string;
  fields: string[];
  defaultOpen?: boolean;
  description?: string;
}

/**
 * UI configuration for the schema
 */
export interface UIConfig {
  sections: UISection[];
  layout?: 'tabs' | 'accordion' | 'flat';
  order?: string[];
}

/**
 * Customization inheritance configuration
 */
export interface CustomizationConfig {
  inherit?: boolean;
  exclude?: string[];
  defaults?: Record<string, unknown>;
}

/**
 * Complete plugin schema
 */
export interface PluginSchema {
  $schema?: string;
  type: 'object';
  title?: string;
  description?: string;
  
  // Properties definition
  properties: Record<string, SchemaProperty>;
  required?: string[];
  
  // UI configuration
  ui?: UIConfig;
  
  // Customization settings
  customization?: CustomizationConfig;
  
  // Default values for the entire block
  defaults?: Record<string, unknown>;
  
  // Computed properties (derived from other values)
  computed?: Record<string, {
    formula: string;
    dependencies: string[];
  }>;
}

/**
 * Schema validation result
 */
export interface SchemaValidationResult {
  valid: boolean;
  errors: SchemaValidationError[];
}

export interface SchemaValidationError {
  path: string;
  message: string;
  value?: unknown;
}

/**
 * Validate a value against a schema property
 */
export function validateProperty(
  value: unknown, 
  property: SchemaProperty
): SchemaValidationResult {
  const errors: SchemaValidationError[] = [];
  
  // Type validation
  const actualType = Array.isArray(value) ? 'array' : typeof value;
  if (actualType !== property.type && !(actualType === 'number' && property.type === 'integer')) {
    errors.push({
      path: '',
      message: `Expected type ${property.type}, got ${actualType}`,
      value,
    });
  }
  
  // String validation
  if (property.type === 'string' && typeof value === 'string') {
    if (property.minLength !== undefined && value.length < property.minLength) {
      errors.push({
        path: '',
        message: `Minimum length is ${property.minLength}`,
        value,
      });
    }
    if (property.maxLength !== undefined && value.length > property.maxLength) {
      errors.push({
        path: '',
        message: `Maximum length is ${property.maxLength}`,
        value,
      });
    }
    if (property.pattern && !new RegExp(property.pattern).test(value)) {
      errors.push({
        path: '',
        message: `Value does not match pattern ${property.pattern}`,
        value,
      });
    }
  }
  
  // Number validation
  if ((property.type === 'number' || property.type === 'integer') && typeof value === 'number') {
    if (property.minimum !== undefined && value < property.minimum) {
      errors.push({
        path: '',
        message: `Minimum value is ${property.minimum}`,
        value,
      });
    }
    if (property.maximum !== undefined && value > property.maximum) {
      errors.push({
        path: '',
        message: `Maximum value is ${property.maximum}`,
        value,
      });
    }
  }
  
  // Enum validation
  if (property.enum && !property.enum.includes(value as string | number)) {
    errors.push({
      path: '',
      message: `Value must be one of: ${property.enum.join(', ')}`,
      value,
    });
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}
