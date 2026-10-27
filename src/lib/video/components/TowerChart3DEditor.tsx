// ============================================================================
// TOWER CHART 3D EDITOR - Properties Panel Editor
// ============================================================================

'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Plus, Trash2, GripVertical, ChevronUp, ChevronDown, Image as ImageIcon } from 'lucide-react';
import type { TowerItem, TowerChart3DBlock } from '@/lib/video/schemas';

interface TowerChart3DEditorProps {
  value: TowerChart3DBlock;
  onChange: (value: TowerChart3DBlock) => void;
}

export function TowerChart3DEditor({ value, onChange }: TowerChart3DEditorProps) {
  const items = value.items || [];
  
  const updateField = <K extends keyof TowerChart3DBlock>(field: K, fieldValue: TowerChart3DBlock[K]) => {
    onChange({ ...value, [field]: fieldValue });
  };
  
  const addItem = () => {
    const newRank = items.length + 1;
    const newItem: TowerItem = {
      rank: newRank,
      name: `Item ${newRank}`,
      value: 1000 * newRank,
      valueFormatted: `${newRank}K`,
      subtitle: 'Category',
      color: undefined,
      image: undefined,
    };
    updateField('items', [...items, newItem]);
  };
  
  const removeItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    // Recalculate ranks
    const reordered = newItems.map((item, i) => ({ ...item, rank: i + 1 }));
    updateField('items', reordered);
  };
  
  const updateItem = (index: number, field: keyof TowerItem, fieldValue: unknown) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: fieldValue };
    updateField('items', newItems);
  };
  
  const moveItem = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= items.length) return;
    
    const newItems = [...items];
    [newItems[index], newItems[newIndex]] = [newItems[newIndex], newItems[index]];
    
    // Recalculate ranks
    const reordered = newItems.map((item, i) => ({ ...item, rank: i + 1 }));
    updateField('items', reordered);
  };
  
  return (
    <div className="space-y-4">
      {/* Title Settings */}
      <Accordion type="single" collapsible defaultValue="title">
        <AccordionItem value="title">
          <AccordionTrigger className="text-sm font-medium">Title & Subtitle</AccordionTrigger>
          <AccordionContent className="space-y-3">
            <div>
              <Label className="text-xs">Title</Label>
              <Input
                value={value.title || ''}
                onChange={(e) => updateField('title', e.target.value)}
                placeholder="Top Rankings"
                className="h-8 mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Subtitle</Label>
              <Input
                value={value.subtitle || ''}
                onChange={(e) => updateField('subtitle', e.target.value)}
                placeholder="Optional description"
                className="h-8 mt-1"
              />
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
      
      {/* Items Editor */}
      <Accordion type="single" collapsible defaultValue="items">
        <AccordionItem value="items">
          <AccordionTrigger className="text-sm font-medium">
            Items ({items.length})
          </AccordionTrigger>
          <AccordionContent className="space-y-3">
            <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1">
              {items.map((item, index) => (
                <div
                  key={index}
                  className="p-3 rounded-lg bg-gray-800/50 border border-gray-700/50 space-y-2"
                >
                  {/* Header with rank and actions */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-400">#{item.rank}</span>
                      <span className="text-xs text-gray-500 truncate max-w-[100px]">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => moveItem(index, 'up')}
                        disabled={index === 0}
                      >
                        <ChevronUp className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => moveItem(index, 'down')}
                        disabled={index === items.length - 1}
                      >
                        <ChevronDown className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-red-400 hover:text-red-300"
                        onClick={() => removeItem(index)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                  
                  {/* Item fields */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px] text-gray-500">Name</Label>
                      <Input
                        value={item.name}
                        onChange={(e) => updateItem(index, 'name', e.target.value)}
                        className="h-7 text-xs mt-0.5"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-gray-500">Value</Label>
                      <Input
                        type="number"
                        value={item.value}
                        onChange={(e) => updateItem(index, 'value', parseFloat(e.target.value) || 0)}
                        className="h-7 text-xs mt-0.5"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px] text-gray-500">Display Value</Label>
                      <Input
                        value={item.valueFormatted || ''}
                        onChange={(e) => updateItem(index, 'valueFormatted', e.target.value)}
                        placeholder="$1.5M"
                        className="h-7 text-xs mt-0.5"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-gray-500">Subtitle</Label>
                      <Input
                        value={item.subtitle || ''}
                        onChange={(e) => updateItem(index, 'subtitle', e.target.value)}
                        placeholder="Category"
                        className="h-7 text-xs mt-0.5"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px] text-gray-500">Color (optional)</Label>
                      <div className="flex gap-1 mt-0.5">
                        <Input
                          type="color"
                          value={item.color || '#3B82F6'}
                          onChange={(e) => updateItem(index, 'color', e.target.value)}
                          className="w-8 h-7 p-0.5 bg-transparent border-0"
                        />
                        <Input
                          value={item.color || ''}
                          onChange={(e) => updateItem(index, 'color', e.target.value || undefined)}
                          placeholder="Auto"
                          className="h-7 text-xs flex-1"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-[10px] text-gray-500">Image URL</Label>
                      <Input
                        value={item.image || ''}
                        onChange={(e) => updateItem(index, 'image', e.target.value || undefined)}
                        placeholder="https://..."
                        className="h-7 text-xs mt-0.5"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <Button
              variant="outline"
              size="sm"
              className="w-full h-8 text-xs"
              onClick={addItem}
            >
              <Plus className="w-3 h-3 mr-1" />
              Add Item
            </Button>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
      
      {/* Visual Settings */}
      <Accordion type="single" collapsible>
        <AccordionItem value="visual">
          <AccordionTrigger className="text-sm font-medium">Visual Settings</AccordionTrigger>
          <AccordionContent className="space-y-3">
            <div>
              <Label className="text-xs">Gradient Start Color</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  type="color"
                  value={value.gradientStart || '#3B82F6'}
                  onChange={(e) => updateField('gradientStart', e.target.value)}
                  className="w-10 h-8 p-1 bg-transparent border-0"
                />
                <Input
                  value={value.gradientStart || '#3B82F6'}
                  onChange={(e) => updateField('gradientStart', e.target.value)}
                  className="h-8 flex-1"
                />
              </div>
            </div>
            
            <div>
              <Label className="text-xs">Gradient End Color</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  type="color"
                  value={value.gradientEnd || '#8B5CF6'}
                  onChange={(e) => updateField('gradientEnd', e.target.value)}
                  className="w-10 h-8 p-1 bg-transparent border-0"
                />
                <Input
                  value={value.gradientEnd || '#8B5CF6'}
                  onChange={(e) => updateField('gradientEnd', e.target.value)}
                  className="h-8 flex-1"
                />
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="useGradient"
                checked={value.useGradientByRank !== false}
                onChange={(e) => updateField('useGradientByRank', e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="useGradient" className="text-xs">Use gradient by rank</Label>
            </div>
            
            <div>
              <Label className="text-xs">Tower Spacing: {value.towerSpacing || 5}</Label>
              <Slider
                value={[value.towerSpacing || 5]}
                onValueChange={([v]) => updateField('towerSpacing', v)}
                min={3}
                max={12}
                step={1}
                className="mt-1"
              />
            </div>
            
            <div>
              <Label className="text-xs">Base Height: {value.baseHeight || 2}</Label>
              <Slider
                value={[value.baseHeight || 2]}
                onValueChange={([v]) => updateField('baseHeight', v)}
                min={1}
                max={8}
                step={1}
                className="mt-1"
              />
            </div>
            
            <div>
              <Label className="text-xs">Max Height: {value.maxHeight || 25}</Label>
              <Slider
                value={[value.maxHeight || 25]}
                onValueChange={([v]) => updateField('maxHeight', v)}
                min={10}
                max={50}
                step={5}
                className="mt-1"
              />
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
      
      {/* Camera Settings */}
      <Accordion type="single" collapsible>
        <AccordionItem value="camera">
          <AccordionTrigger className="text-sm font-medium">Camera Animation</AccordionTrigger>
          <AccordionContent className="space-y-3">
            <div>
              <Label className="text-xs">Camera Distance: {value.cameraDistance || 25}</Label>
              <Slider
                value={[value.cameraDistance || 25]}
                onValueChange={([v]) => updateField('cameraDistance', v)}
                min={15}
                max={50}
                step={5}
                className="mt-1"
              />
            </div>
            
            <div>
              <Label className="text-xs">Camera Angle: {value.cameraAngle || 25}°</Label>
              <Slider
                value={[value.cameraAngle || 25]}
                onValueChange={([v]) => updateField('cameraAngle', v)}
                min={0}
                max={60}
                step={5}
                className="mt-1"
              />
            </div>
            
            <div>
              <Label className="text-xs">Pause Duration: {value.cameraPauseDuration || 0.5}s</Label>
              <Slider
                value={[value.cameraPauseDuration || 0.5]}
                onValueChange={([v]) => updateField('cameraPauseDuration', v)}
                min={0.2}
                max={2}
                step={0.1}
                className="mt-1"
              />
            </div>
            
            <div>
              <Label className="text-xs">Move Speed: {value.cameraMoveSpeed || 0.6}s</Label>
              <Slider
                value={[value.cameraMoveSpeed || 0.6]}
                onValueChange={([v]) => updateField('cameraMoveSpeed', v)}
                min={0.3}
                max={2}
                step={0.1}
                className="mt-1"
              />
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
      
      {/* Scene Settings */}
      <Accordion type="single" collapsible>
        <AccordionItem value="scene">
          <AccordionTrigger className="text-sm font-medium">Scene Settings</AccordionTrigger>
          <AccordionContent className="space-y-3">
            <div>
              <Label className="text-xs">Background Color</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  type="color"
                  value={value.backgroundColor || '#0d0d1a'}
                  onChange={(e) => updateField('backgroundColor', e.target.value)}
                  className="w-10 h-8 p-1 bg-transparent border-0"
                />
                <Input
                  value={value.backgroundColor || '#0d0d1a'}
                  onChange={(e) => updateField('backgroundColor', e.target.value)}
                  className="h-8 flex-1"
                />
              </div>
            </div>
            
            <div>
              <Label className="text-xs">Ground Color</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  type="color"
                  value={value.groundColor || '#1a1a2e'}
                  onChange={(e) => updateField('groundColor', e.target.value)}
                  className="w-10 h-8 p-1 bg-transparent border-0"
                />
                <Input
                  value={value.groundColor || '#1a1a2e'}
                  onChange={(e) => updateField('groundColor', e.target.value)}
                  className="h-8 flex-1"
                />
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="showGround"
                checked={value.showGround !== false}
                onChange={(e) => updateField('showGround', e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="showGround" className="text-xs">Show ground</Label>
            </div>
            
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="showLabels"
                checked={value.showLabels3D !== false}
                onChange={(e) => updateField('showLabels3D', e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="showLabels" className="text-xs">Show 3D labels</Label>
            </div>
            
            <div>
              <Label className="text-xs">Ambient Intensity: {value.ambientIntensity || 0.5}</Label>
              <Slider
                value={[value.ambientIntensity || 0.5]}
                onValueChange={([v]) => updateField('ambientIntensity', v)}
                min={0.3}
                max={1.5}
                step={0.1}
                className="mt-1"
              />
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

export default TowerChart3DEditor;
