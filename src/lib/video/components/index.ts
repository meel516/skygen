// ============================================================================
// VIDEO ENGINE COMPONENTS INDEX
// ============================================================================

// Base components
export { BaseScene, ThemedText, CenteredContent } from './BaseScene';
export type { BaseSceneProps } from './BaseScene';

// Fixed components (Intro/Outro)
export { Intro, Outro } from './IntroOutro';
export type { IntroProps, OutroProps } from './IntroOutro';

// Dynamic components
export { StatScene, MultiStatScene } from './StatScene';
export type { StatSceneProps, MultiStatSceneProps } from './StatScene';

export { ComparisonScene, DonutComparison } from './ComparisonScene';
export type { ComparisonSceneProps, DonutComparisonProps } from './ComparisonScene';

export { TextScene, QuoteScene, HighlightTextScene } from './TextScene';
export type { TextSceneProps, QuoteSceneProps, HighlightTextSceneProps } from './TextScene';

export { WhatsAppChatScene } from './WhatsAppChatScene';
export type { WhatsAppChatSceneProps } from './WhatsAppChatScene';

export { WeatherScene } from './WeatherScene';
export type { WeatherSceneProps } from './WeatherScene';

export { TowerChart3DScene } from './TowerChart3DScene';
export type { TowerChart3DSceneProps } from './TowerChart3DScene';

export { BarRace3DScene } from './BarRace3DScene';
export type { BarRace3DSceneProps } from './BarRace3DScene';

// Note: TowerChart3DEditor is NOT exported here because it imports UI components
// that cannot be bundled by Remotion. Import it directly from './TowerChart3DEditor'
// in the main app only, not in video compositions.

// Component registry for dynamic lookup
import { COMPONENT_IDS } from '../schemas';
import type { ComponentId, ContentBlock } from '../schemas';

export interface ComponentConfig {
  id: ComponentId;
  name: string;
  defaultProps?: Record<string, unknown>;
}

/**
 * Component registry for dynamic rendering
 */
export const COMPONENT_REGISTRY: Record<ComponentId, ComponentConfig> = {
  [COMPONENT_IDS.INTRO]: {
    id: COMPONENT_IDS.INTRO,
    name: 'Intro',
    defaultProps: { title: 'Video Report' },
  },
  [COMPONENT_IDS.OUTRO]: {
    id: COMPONENT_IDS.OUTRO,
    name: 'Outro',
    defaultProps: { message: 'Thank You' },
  },
  [COMPONENT_IDS.STAT]: {
    id: COMPONENT_IDS.STAT,
    name: 'Stat Scene',
    defaultProps: {},
  },
  [COMPONENT_IDS.COMPARISON]: {
    id: COMPONENT_IDS.COMPARISON,
    name: 'Comparison Scene',
    defaultProps: {},
  },
  [COMPONENT_IDS.TEXT]: {
    id: COMPONENT_IDS.TEXT,
    name: 'Text Scene',
    defaultProps: {},
  },
  [COMPONENT_IDS.QUOTE]: {
    id: COMPONENT_IDS.QUOTE,
    name: 'Quote Scene',
    defaultProps: {},
  },
  [COMPONENT_IDS.IMAGE]: {
    id: COMPONENT_IDS.IMAGE,
    name: 'Image Scene',
    defaultProps: {},
  },
  [COMPONENT_IDS.WHATSAPP_CHAT]: {
    id: COMPONENT_IDS.WHATSAPP_CHAT,
    name: 'WhatsApp Chat Scene',
    defaultProps: {},
  },
};

/**
 * Get component configuration by ID
 */
export function getComponentConfig(id: ComponentId): ComponentConfig | undefined {
  return COMPONENT_REGISTRY[id];
}

/**
 * Get component ID for content block type
 */
export function getComponentIdForType(type: ContentBlock['type']): ComponentId {
  const mapping: Record<string, ComponentId> = {
    stat: COMPONENT_IDS.STAT,
    comparison: COMPONENT_IDS.COMPARISON,
    text: COMPONENT_IDS.TEXT,
    quote: COMPONENT_IDS.QUOTE,
    image: COMPONENT_IDS.IMAGE,
    'whatsapp-chat': COMPONENT_IDS.WHATSAPP_CHAT,
  };
  
  return mapping[type] ?? COMPONENT_IDS.TEXT;
}
