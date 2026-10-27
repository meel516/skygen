// ============================================================================
// SCHEMA TO UI - Convert plugin schema to editor UI components
// ============================================================================

import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import type { 
  PluginSchema, 
  SchemaProperty, 
  UISection,
  EditorType,
  EditorConfig 
} from '../../../shared/plugin-types';

/**
 * Field editor props
 */
export interface FieldEditorProps {
  field: string;
  property: SchemaProperty;
  value: unknown;
  onChange: (value: unknown) => void;
  disabled?: boolean;
}

/**
 * Individual field editor component
 */
export const FieldEditor: React.FC<FieldEditorProps> = ({
  field,
  property,
  value,
  onChange,
  disabled = false,
}) => {
  const editorType = property.editor || getDefaultEditorType(property.type);
  // AI-generated schemas often omit `title`; fall back to the humanized key.
  const labelText = property.title ?? humanizeKey(field);

  switch (editorType) {
    case 'text':
      return (
        <div>
          <Label className="text-xs text-gray-400">{labelText}</Label>
          <Input
            value={(value as string) ?? (property.default as string) ?? ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={property.description}
            disabled={disabled}
            className="bg-gray-800/50 border-gray-700/50 text-white h-10"
          />
        </div>
      );
    
    case 'textarea':
      return (
        <div>
          <Label className="text-xs text-gray-400">{labelText}</Label>
          <Textarea
            value={(value as string) ?? (property.default as string) ?? ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={property.description}
            disabled={disabled}
            className="bg-gray-800/50 border-gray-700/50 text-white min-h-[80px]"
            rows={property.editorConfig?.rows || 3}
          />
        </div>
      );
    
    case 'number':
      return (
        <div>
          <Label className="text-xs text-gray-400">{labelText}</Label>
          <Input
            type="number"
            value={(value as number) ?? (property.default as number) ?? 0}
            onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
            placeholder={property.description}
            disabled={disabled}
            min={property.editorConfig?.min ?? property.minimum}
            max={property.editorConfig?.max ?? property.maximum}
            step={property.editorConfig?.step}
            className="bg-gray-800/50 border-gray-700/50 text-white h-10"
          />
        </div>
      );
    
    case 'select':
      return (
        <div>
          <Label className="text-xs text-gray-400">{labelText}</Label>
          <Select
            value={(value as string) ?? (property.default as string) ?? ''}
            onValueChange={onChange}
            disabled={disabled}
          >
            <SelectTrigger className="bg-gray-800/50 border-gray-700/50 text-white h-10">
              <SelectValue placeholder={property.description} />
            </SelectTrigger>
            <SelectContent>
              {(property.enum || []).map((option) => (
                <SelectItem key={String(option)} value={String(option)}>
                  {property.enumLabels?.[String(option)] || String(option)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    
    case 'color':
      return (
        <div>
          <Label className="text-xs text-gray-400">{labelText}</Label>
          <div className="flex gap-2 items-center">
            <input
              type="color"
              value={(value as string) ?? (property.default as string) ?? '#000000'}
              onChange={(e) => onChange(e.target.value)}
              disabled={disabled}
              className="w-10 h-10 rounded cursor-pointer border-0"
            />
            <Input
              value={(value as string) ?? (property.default as string) ?? '#000000'}
              onChange={(e) => onChange(e.target.value)}
              disabled={disabled}
              className="bg-gray-800/50 border-gray-700/50 text-white h-10 flex-1"
            />
          </div>
        </div>
      );
    
    case 'slider':
      return (
        <div>
          <div className="flex justify-between items-center mb-2">
            <Label className="text-xs text-gray-400">{labelText}</Label>
            <span className="text-xs text-gray-500">
              {(value as number) ?? (property.default as number) ?? 0}
              {property.editorConfig?.unit || ''}
            </span>
          </div>
          <Slider
            value={[(value as number) ?? (property.default as number) ?? 0]}
            onValueChange={([v]) => onChange(v)}
            min={property.editorConfig?.min ?? property.minimum ?? 0}
            max={property.editorConfig?.max ?? property.maximum ?? 100}
            step={property.editorConfig?.step ?? 1}
            disabled={disabled}
          />
        </div>
      );
    
    case 'toggle':
      return (
        <div className="flex items-center justify-between">
          <Label className="text-xs text-gray-400">{labelText}</Label>
          <Switch
            checked={(value as boolean) ?? (property.default as boolean) ?? false}
            onCheckedChange={onChange}
            disabled={disabled}
          />
        </div>
      );
    
    case 'image':
      return (
        <div>
          <Label className="text-xs text-gray-400">{labelText}</Label>
          <div className="flex gap-2">
            <Input
              value={(value as string) ?? ''}
              onChange={(e) => onChange(e.target.value)}
              placeholder="Image URL"
              disabled={disabled}
              className="bg-gray-800/50 border-gray-700/50 text-white h-10 flex-1"
            />
            <label className="flex items-center justify-center px-3 bg-gray-700 rounded cursor-pointer hover:bg-gray-600">
              <span className="text-sm">📁</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    // Handle file upload
                    const reader = new FileReader();
                    reader.onload = (e) => {
                      onChange(e.target?.result as string);
                    };
                    reader.readAsDataURL(file);
                  }
                }}
              />
            </label>
          </div>
        </div>
      );
    
    default:
      return (
        <div>
          <Label className="text-xs text-gray-400">{labelText}</Label>
          <Input
            value={String(value ?? property.default ?? '')}
            onChange={(e) => onChange(e.target.value)}
            placeholder={property.description}
            disabled={disabled}
            className="bg-gray-800/50 border-gray-700/50 text-white h-10"
          />
        </div>
      );
  }
};

/**
 * Get default editor type for property type
 */
function getDefaultEditorType(type: SchemaProperty['type']): EditorType {
  switch (type) {
    case 'string':
      return 'text';
    case 'number':
    case 'integer':
      return 'number';
    case 'boolean':
      return 'toggle';
    case 'array':
      return 'array';
    case 'object':
      return 'object';
    default:
      return 'text';
  }
}

/**
 * Turn a camelCase or snake_case property key into a human label.
 * `imageUrl` → "Image Url", `background_color` → "Background Color".
 */
function humanizeKey(key: string): string {
  return key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Editor section configuration
 */
export interface GeneratedSection {
  title: string;
  icon: string;
  fields: GeneratedField[];
  defaultOpen: boolean;
}

export interface GeneratedField {
  key: string;
  property: SchemaProperty;
}

/**
 * Generate editor sections from schema
 */
export function generateEditorFromSchema(schema: PluginSchema): GeneratedSection[] {
  // If schema has UI sections defined, use those
  if (schema.ui?.sections) {
    return schema.ui.sections.map((section) => ({
      title: section.title,
      icon: section.icon || 'Settings',
      fields: section.fields
        .filter((field) => schema.properties[field])
        .map((field) => ({
          key: field,
          property: schema.properties[field],
        })),
      defaultOpen: section.defaultOpen ?? false,
    }));
  }
  
  // Otherwise, auto-generate sections
  const sections: GeneratedSection[] = [];
  const grouped: Record<string, GeneratedField[]> = {};
  
  // Group properties by type/category
  for (const [key, property] of Object.entries(schema.properties)) {
    const category = getPropertyCategory(property, key);
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push({ key, property });
  }
  
  // Create sections
  const categoryOrder = ['Content', 'Animation', 'Style', 'Advanced'];
  for (const category of categoryOrder) {
    if (grouped[category]) {
      sections.push({
        title: category,
        icon: getCategoryIcon(category),
        fields: grouped[category],
        defaultOpen: category === 'Content',
      });
    }
  }
  
  // Add remaining categories
  for (const [category, fields] of Object.entries(grouped)) {
    if (!categoryOrder.includes(category)) {
      sections.push({
        title: category,
        icon: getCategoryIcon(category),
        fields,
        defaultOpen: false,
      });
    }
  }
  
  return sections;
}

/**
 * Get property category
 */
function getPropertyCategory(property: SchemaProperty, key: string): string {
  const animKeywords = ['animation', 'duration', 'delay', 'easing', 'transition', 'speed'];
  const styleKeywords = ['color', 'background', 'font', 'size', 'border', 'shadow', 'glow'];

  // AI-generated schemas often omit `title`. Fall back to the property key,
  // which carries the same signal (camelCase names like `animationDuration`
  // still match the keyword lists).
  const titleLower = (property.title ?? key).toLowerCase();
  const descLower = property.description?.toLowerCase() ?? '';

  if (animKeywords.some((k) => titleLower.includes(k) || descLower.includes(k))) {
    return 'Animation';
  }

  if (styleKeywords.some((k) => titleLower.includes(k) || descLower.includes(k))) {
    return 'Style';
  }

  return 'Content';
}

/**
 * Get icon for category
 */
function getCategoryIcon(category: string): string {
  const icons: Record<string, string> = {
    Content: 'Type',
    Animation: 'Zap',
    Style: 'Palette',
    Advanced: 'Settings',
    Layout: 'Layout',
    Media: 'Image',
  };
  return icons[category] || 'Settings';
}

/**
 * Validate data against schema
 */
export function validateData(
  data: Record<string, unknown>,
  schema: PluginSchema
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check required fields
  if (schema.required) {
    for (const field of schema.required) {
      if (data[field] === undefined || data[field] === null || data[field] === '') {
        errors.push(`${field} is required`);
      }
    }
  }
  
  // Validate each property
  for (const [key, property] of Object.entries(schema.properties)) {
    const value = data[key];
    
    if (value === undefined) continue;
    
    // Type validation
    switch (property.type) {
      case 'string':
        if (typeof value !== 'string') {
          errors.push(`${key} must be a string`);
        }
        break;
      case 'number':
      case 'integer':
        if (typeof value !== 'number') {
          errors.push(`${key} must be a number`);
        }
        break;
      case 'boolean':
        if (typeof value !== 'boolean') {
          errors.push(`${key} must be a boolean`);
        }
        break;
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get default values from schema
 */
export function getDefaultsFromSchema(schema: PluginSchema): Record<string, unknown> {
  const defaults: Record<string, unknown> = {};
  
  for (const [key, property] of Object.entries(schema.properties)) {
    if (property.default !== undefined) {
      defaults[key] = property.default;
    }
  }
  
  return { ...defaults, ...schema.defaults };
}

export default FieldEditor;
