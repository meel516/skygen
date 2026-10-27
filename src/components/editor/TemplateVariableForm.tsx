'use client';

import { TemplateVariable } from '@/lib/video/templates/template-definitions';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface TemplateVariableFormProps {
  variables: TemplateVariable[];
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
}

export function TemplateVariableForm({ variables, values, onChange }: TemplateVariableFormProps) {
  const handleChange = (key: string, value: string) => {
    onChange({ ...values, [key]: value });
  };

  return (
    <div className="space-y-5">
      {variables.map(variable => (
        <div key={variable.key} className="space-y-2">
          <Label className="text-gray-300 flex items-center gap-2">
            {variable.label}
            {variable.required && <span className="text-red-400">*</span>}
          </Label>

          {variable.type === 'textarea' ? (
            <Textarea
              value={values[variable.key] || ''}
              onChange={e => handleChange(variable.key, e.target.value)}
              placeholder={variable.placeholder}
              className="bg-gray-800 border-gray-700 text-slate-900 dark:text-white placeholder:text-gray-500 min-h-[100px]"
              required={variable.required}
            />
          ) : variable.type === 'image' || variable.type === 'audio' ? (
            <div className="space-y-2">
              <Input
                type="url"
                value={values[variable.key] || ''}
                onChange={e => handleChange(variable.key, e.target.value)}
                placeholder={variable.placeholder || `Enter ${variable.type} URL`}
                className="bg-gray-800 border-gray-700 text-slate-900 dark:text-white placeholder:text-gray-500"
              />
              {variable.type === 'image' && values[variable.key] && (
                <div className="relative h-24 w-full bg-gray-800 rounded-lg overflow-hidden">
                  <img
                    src={values[variable.key]}
                    alt="Preview"
                    className="object-cover w-full h-full"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>
          ) : (
            <Input
              type="text"
              value={values[variable.key] || ''}
              onChange={e => handleChange(variable.key, e.target.value)}
              placeholder={variable.placeholder}
              className="bg-gray-800 border-gray-700 text-slate-900 dark:text-white placeholder:text-gray-500"
              required={variable.required}
            />
          )}
        </div>
      ))}
    </div>
  );
}