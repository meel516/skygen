import ZAI from 'z-ai-web-dev-sdk';
import {
  type ContentBlock,
  type AIDecision,
  type VideoPlan,
  type VideoMeta,
  AIDecisionSchema,
  COMPONENT_IDS,
  MotionProfileSchema,
  AnimationPhaseSchema,
} from '../schemas';

// ============================================================================
// AI DECISION ROUTER - Intelligence Layer
// ============================================================================

/**
 * The AI is strictly a "Decision Router."
 * It does NOT write scripts. It does NOT generate content.
 * Input: A single contentBlock (JSON)
 * Output: A structured decision object
 */

// Type guard for parsing AI response
interface AIDecisionRaw {
  componentId: string;
  motionProfile: 'subtle' | 'dynamic' | 'energetic';
  duration: number;
  animation?: {
    enter: number;
    hold: number;
    exit: number;
  };
}

/**
 * Minimal prompt for token efficiency
 */
const DECISION_PROMPT = `Route content to component. Return JSON: {componentId, motionProfile, duration, animation:{enter,hold,exit}}.
Rules:
- stat→stat-scene, comparison→comparison-scene, text→text-scene, quote→quote-scene
- list→list-scene, timeline→timeline-scene, callout→callout-scene
- icon-list→icon-list-scene, line-chart→line-chart-scene, pie-chart→pie-chart-scene
- code→code-scene, testimonial→testimonial-scene, whatsapp-chat→whatsapp-chat-scene
- motivational-image→motivational-image-scene
- motionProfile: subtle|dynamic|energetic (complexity-based)
- duration: 2-8s for most content, 5-60s for whatsapp-chat, 4-120s for motivational-image (use provided duration if available)
- animation: enter/hold/exit in seconds, total=duration`;

/**
 * Analyze content block and determine rendering parameters
 */
async function routeBlock(block: ContentBlock, index: number): Promise<AIDecision> {
  let zai: Awaited<ReturnType<typeof ZAI.create>>;
  
  try {
    zai = await ZAI.create();
  } catch (error) {
    console.error('Failed to initialize ZAI:', error);
    return getDefaultDecision(block, index);
  }

  const blockJson = JSON.stringify(block);

  try {
    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'assistant',
          content: DECISION_PROMPT,
        },
        {
          role: 'user',
          content: blockJson,
        },
      ],
      thinking: { type: 'disabled' },
    });

    const responseText = completion.choices[0]?.message?.content;
    
    if (!responseText) {
      return getDefaultDecision(block, index);
    }

    // Parse JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return getDefaultDecision(block, index);
    }

    const parsed = JSON.parse(jsonMatch[0]) as AIDecisionRaw;
    
    // Validate with Zod
    const motionProfile = MotionProfileSchema.parse(parsed.motionProfile);
    const animation = parsed.animation ? AnimationPhaseSchema.parse(parsed.animation) : undefined;
    
    // Validate component ID matches block type
    const componentId = validateComponentId(parsed.componentId, block.type);
    
    return {
      componentId,
      motionProfile,
      duration: Math.max(1, Math.min(60, parsed.duration)),
      animation,
    };
  } catch (error) {
    console.error('AI routing error:', error);
    return getDefaultDecision(block, index);
  }
}

/**
 * Validate component ID matches the content type
 */
function validateComponentId(componentId: string, blockType: string): string {
  const validMapping: Record<string, string> = {
    'stat': COMPONENT_IDS.STAT,
    'comparison': COMPONENT_IDS.COMPARISON,
    'text': COMPONENT_IDS.TEXT,
    'image': COMPONENT_IDS.IMAGE,
    'quote': COMPONENT_IDS.QUOTE,
    'list': COMPONENT_IDS.LIST,
    'timeline': COMPONENT_IDS.TIMELINE,
    'callout': COMPONENT_IDS.CALLOUT,
    'icon-list': COMPONENT_IDS.ICON_LIST,
    'line-chart': COMPONENT_IDS.LINE_CHART,
    'pie-chart': COMPONENT_IDS.PIE_CHART,
    'code': COMPONENT_IDS.CODE,
    'testimonial': COMPONENT_IDS.TESTIMONIAL,
    'whatsapp-chat': COMPONENT_IDS.WHATSAPP_CHAT,
    'motivational-image': COMPONENT_IDS.MOTIVATIONAL_IMAGE,
    'counter': COMPONENT_IDS.COUNTER,
    'progress-bar': COMPONENT_IDS.PROGRESS_BAR,
    'qr-code': COMPONENT_IDS.QR_CODE,
    'video': COMPONENT_IDS.VIDEO,
    'avatar-grid': COMPONENT_IDS.AVATAR_GRID,
    'social-stats': COMPONENT_IDS.SOCIAL_STATS,
    'cta': COMPONENT_IDS.CTA,
    'gradient-text': COMPONENT_IDS.GRADIENT_TEXT,
    'animated-bg': COMPONENT_IDS.ANIMATED_BG,
    'countdown': COMPONENT_IDS.COUNTDOWN,
    'weather-block': COMPONENT_IDS.WEATHER,
    'tower-chart-3d': COMPONENT_IDS.TOWER_CHART_3D,
    'bar-race-3d': COMPONENT_IDS.BAR_RACE_3D,
    'parallax-story': COMPONENT_IDS.PARALLAX_STORY,
    'pricing-table': COMPONENT_IDS.PRICING_TABLE,
    'logo-wall': COMPONENT_IDS.LOGO_WALL,
    'process-steps': COMPONENT_IDS.PROCESS_STEPS,
    'html': COMPONENT_IDS.HTML,
    'diagram': COMPONENT_IDS.DIAGRAM,
    'top-players': COMPONENT_IDS.TOP_PLAYERS,
    'custom-plugin': 'custom-plugin',
  };

  return validMapping[blockType] || componentId;
}

/**
 * Fallback decision when AI fails
 */
function getDefaultDecision(block: ContentBlock, index: number): AIDecision {
  const typeToComponent: Record<string, string> = {
    stat: COMPONENT_IDS.STAT,
    comparison: COMPONENT_IDS.COMPARISON,
    text: COMPONENT_IDS.TEXT,
    image: COMPONENT_IDS.IMAGE,
    quote: COMPONENT_IDS.QUOTE,
    list: COMPONENT_IDS.LIST,
    timeline: COMPONENT_IDS.TIMELINE,
    callout: COMPONENT_IDS.CALLOUT,
    'icon-list': COMPONENT_IDS.ICON_LIST,
    'line-chart': COMPONENT_IDS.LINE_CHART,
    'pie-chart': COMPONENT_IDS.PIE_CHART,
    code: COMPONENT_IDS.CODE,
    testimonial: COMPONENT_IDS.TESTIMONIAL,
    'whatsapp-chat': COMPONENT_IDS.WHATSAPP_CHAT,
    'motivational-image': COMPONENT_IDS.MOTIVATIONAL_IMAGE,
    'counter': COMPONENT_IDS.COUNTER,
    'progress-bar': COMPONENT_IDS.PROGRESS_BAR,
    'qr-code': COMPONENT_IDS.QR_CODE,
    'video': COMPONENT_IDS.VIDEO,
    'avatar-grid': COMPONENT_IDS.AVATAR_GRID,
    'social-stats': COMPONENT_IDS.SOCIAL_STATS,
    'cta': COMPONENT_IDS.CTA,
    'gradient-text': COMPONENT_IDS.GRADIENT_TEXT,
    'animated-bg': COMPONENT_IDS.ANIMATED_BG,
    'countdown': COMPONENT_IDS.COUNTDOWN,
    'weather-block': COMPONENT_IDS.WEATHER,
    'tower-chart-3d': COMPONENT_IDS.TOWER_CHART_3D,
    'bar-race-3d': COMPONENT_IDS.BAR_RACE_3D,
    'parallax-story': COMPONENT_IDS.PARALLAX_STORY,
    'pricing-table': COMPONENT_IDS.PRICING_TABLE,
    'logo-wall': COMPONENT_IDS.LOGO_WALL,
    'process-steps': COMPONENT_IDS.PROCESS_STEPS,
    'html': COMPONENT_IDS.HTML,
    'diagram': COMPONENT_IDS.DIAGRAM,
    'top-players': COMPONENT_IDS.TOP_PLAYERS,
    'custom-plugin': 'custom-plugin',
  };

  // Determine motion profile based on content complexity
  let motionProfile: 'subtle' | 'dynamic' | 'energetic' = 'subtle';
  
  if (block.type === 'comparison' && block.items.length > 3) {
    motionProfile = 'energetic';
  } else if (block.type === 'stat' || block.type === 'quote' || block.type === 'callout' || block.type === 'testimonial') {
    motionProfile = 'dynamic';
  } else if (block.type === 'timeline' || block.type === 'list' || block.type === 'icon-list') {
    motionProfile = 'dynamic';
  } else if (block.type === 'line-chart' || block.type === 'pie-chart') {
    motionProfile = 'dynamic';
  } else if (block.type === 'code') {
    motionProfile = 'subtle';
  } else if (block.type === 'whatsapp-chat') {
    motionProfile = 'subtle'; // Chat should have subtle, natural animations
  } else if (block.type === 'motivational-image') {
    motionProfile = 'dynamic'; // Motivational images should have dynamic, inspiring animations
  }

  // Determine duration based on content
  let duration = 3;
  
  if (block.type === 'comparison') {
    duration = 4 + Math.floor(block.items.length / 2);
  } else if (block.type === 'text') {
    duration = Math.min(6, Math.ceil(block.content.length / 50));
  } else if (block.type === 'list') {
    duration = 3 + Math.ceil(block.items.length * 0.5);
  } else if (block.type === 'timeline') {
    duration = 4 + Math.ceil(block.events.length * 0.5);
  } else if (block.type === 'callout') {
    duration = 3;
  } else if (block.type === 'icon-list') {
    duration = 3 + Math.ceil(block.items.length * 0.5);
  } else if (block.type === 'line-chart') {
    duration = 4;
  } else if (block.type === 'pie-chart') {
    duration = 4;
  } else if (block.type === 'code') {
    duration = Math.min(8, Math.ceil(block.code.length / 100));
  } else if (block.type === 'whatsapp-chat') {
    // Chat duration calculation based on actual component timing:
    // - Adaptive message delay: fewer messages = slower, more messages = faster
    const messageCount = block.messages?.length || 1;
    const messageDelay = messageCount <= 5 ? 2.0 
      : messageCount <= 15 ? 1.5 
      : messageCount <= 30 ? 1.0 
      : 0.8; // 0.8s for 30+ messages
    const typingDuration = 2.5;
    duration = 0.5 + typingDuration + messageCount * messageDelay + 1.5;
    // Cap at 60 seconds for very long chats
    duration = Math.min(60, duration);
  } else if (block.type === 'testimonial') {
    duration = 4;
  } else if (block.type === 'counter') {
    duration = 4;
  } else if (block.type === 'progress-bar') {
    duration = 3;
  } else if (block.type === 'qr-code') {
    duration = 4;
  } else if (block.type === 'video') {
    duration = 5;
  } else if (block.type === 'avatar-grid') {
    duration = 5;
  } else if (block.type === 'social-stats') {
    duration = 4;
  } else if (block.type === 'cta') {
    duration = 3;
  } else if (block.type === 'gradient-text') {
    duration = 4;
  } else if (block.type === 'animated-bg') {
    duration = 5;
  } else if (block.type === 'countdown') {
    duration = 4;
  } else if (block.type === 'weather-block') {
    duration = 4;
  } else if (block.type === 'tower-chart-3d') {
    duration = 20;
  } else if (block.type === 'bar-race-3d') {
    duration = 15;
  } else if (block.type === 'parallax-story') {
    duration = 10;
  } else if (block.type === 'top-players') {
    if ((block as any).duration) {
      duration = (block as any).duration;
    } else {
      const players = (block as any).players || [];
      const per = (block as any).defaultPerPlayerSeconds ?? 3;
      duration = Math.min(60, players.length * (per + 0.5));
    }
  } else if (block.type === 'pricing-table') {
    duration = 6;
  } else if (block.type === 'logo-wall') {
    duration = 5;
  } else if (block.type === 'process-steps') {
    duration = 5;
  } else if (block.type === 'html') {
    duration = 5;
  } else if (block.type === 'diagram') {
    const nodeCount = (block as any).nodes?.length || 4;
    duration = Math.min(10, 3 + nodeCount * 0.5);
  } else if (block.type === 'motivational-image') {
    // Motivational image duration logic:
    // 1. If duration is provided → use it directly
    // 2. If audioSrc provided but no duration → calculate from text + extra for audio
    // 3. If no audio, no duration → calculate from text length
    if (block.duration) {
      // Duration explicitly provided - use it
      duration = block.duration;
    } else if (block.audioSrc) {
      // Audio provided but no duration - calculate from text + buffer for audio
      const textLength = block.text?.length || 0;
      const readingTime = Math.ceil(textLength / 20); // ~20 chars per second with audio
      duration = Math.max(5, readingTime + 3); // At least 5s, with buffer
    } else {
      // No audio, no duration - calculate from text length (existing behavior)
      const textLength = block.text?.length || 0;
      const baseDuration = 4;
      const readingTime = Math.ceil(textLength / 30); // ~30 chars per second reading
      duration = Math.min(10, baseDuration + readingTime);
    }
  }

  return {
    componentId: typeToComponent[block.type] || COMPONENT_IDS.TEXT,
    motionProfile,
    duration,
    animation: {
      enter: 0.4,
      hold: duration - 0.6,
      exit: 0.2,
    },
  };
}

/**
 * Generate complete video plan from content blocks
 */
export async function generateVideoPlan(
  videoMeta: VideoMeta,
  contentBlocks: ContentBlock[]
): Promise<VideoPlan> {
  // Process all blocks in parallel for efficiency
  const decisions = await Promise.all(
    contentBlocks.map((block, index) => routeBlock(block, index))
  );

  // Calculate total duration
  const introDuration = 2;
  const outroDuration = 2;
  const contentDuration = decisions.reduce((sum, d) => sum + d.duration, 0);
  const totalDuration = introDuration + contentDuration + outroDuration;

  // Suggest transitions based on motion profiles
  const suggestedTransitions = determineTransitions(decisions);

  return {
    decisions,
    totalDuration,
    suggestedTransitions,
  };
}

/**
 * Determine transition types based on motion profiles
 */
function determineTransitions(decisions: AIDecision[]): ('fade' | 'slide' | 'zoom' | 'wipe')[] {
  const transitions: ('fade' | 'slide' | 'zoom' | 'wipe')[] = [];
  
  for (let i = 0; i < decisions.length - 1; i++) {
    const current = decisions[i];
    const next = decisions[i + 1];
    
    // Choose transition based on motion profile changes
    if (current.motionProfile === 'energetic' || next.motionProfile === 'energetic') {
      transitions.push('zoom');
    } else if (current.motionProfile !== next.motionProfile) {
      transitions.push('slide');
    } else {
      transitions.push('fade');
    }
  }
  
  return transitions;
}

/**
 * Route a single block (for incremental processing)
 */
export async function routeContentBlock(
  block: ContentBlock,
  index: number
): Promise<AIDecision> {
  return routeBlock(block, index);
}

/**
 * Validate AI decision output
 */
export function validateDecision(decision: unknown): AIDecision | null {
  try {
    return AIDecisionSchema.parse(decision);
  } catch {
    return null;
  }
}
