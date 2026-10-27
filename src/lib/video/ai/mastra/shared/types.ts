
// ============================================================================
// SHARED TYPES — owned by the Mastra layer (no graph.ts dependency)
// ============================================================================

export interface ArcPattern {
  name: string;
  description: string;
  roles: string[];
  defaultTone: string;
}

export type ConsistencyLens = 'character' | 'concept' | 'event_history' | 'product' | 'motivational';

export interface ConsistencyLensConfig {
  description: string;
  whenToSelect: string;
  visualStyleDirective: string;
  storyBibleDirective: string;
  contentGeneratorHint: string;
}

export interface NarrativeBrief {
  narrativeRole: string;
  angle: string;
  tone: string;
  keyMessage: string;
  visualMood: string;
  spokenScript: string;
  transitionIn: string;
  transitionOut: string;
}

export interface BlockStrategy {
  blockIndex: number;
  blockType: string;
  imageSource: 'web_search' | 'ai_generation' | 'auto';
  searchQueryStyle: 'screenshot' | 'photo' | 'diagram' | null;
  autoScreenshot: boolean;
  minWidth: number;
  reasoning: string;
}

export interface MediaStrategy {
  needsResearch: boolean;
  needsNewsSearch: boolean;
  researchQueries: string[];
  topicType: 'factual' | 'creative' | 'mixed';
  blockStrategies: BlockStrategy[];
}

export interface WizardImageItem {
  blockIdx: number;
  fieldPath: string;
  url: string;
  description: string;
  removeBackground: boolean;
}

export interface WizardVideoItem {
  blockIdx: number;
  fieldPath: string;
  url: string;
  description: string;
}

export interface GenerateVideoPayloadResult {
  success: boolean;
  selectedArc: string;
  payload: {
    videoMeta: Record<string, any>;
    contentBlocks: Record<string, any>[];
  };
  errors: string[];
  tokensUsed: number;
}

export interface WizardResult {
  status: 'interrupted' | 'complete';
  interrupt?: Record<string, any>;
  payload?: Record<string, any>;
  stateSnapshot?: Record<string, any>;
  tokensUsed: number;
  /** In inline mode, preview data is attached here for immediate display in chat */
  preview?: Record<string, any>;
}
