import { ContentBlock, VideoMeta, AudioTrack } from '../schemas';

/**
 * Template variable types - defines what data is needed to fill a template
 */
export interface TemplateVariable {
  key: string; // e.g., "title", "script", "backgroundMusic"
  label: string; // Display label for the form
  type: 'text' | 'textarea' | 'image' | 'audio' | 'url';
  placeholder?: string;
  required: boolean;
  defaultValue?: string;
}

/**
 * Video template definition
 */
export interface VideoTemplate {
  id: string;
  name: string;
  description: string;
  category: 'motivation' | 'food' | 'tutorial' | 'business' | 'lifestyle';
  thumbnail?: string;
  videoMeta: VideoMeta;
  blocks: ContentBlock[]; // Blocks with {{variable}} placeholders
  requiredVariables: TemplateVariable[];
  audioTracks?: AudioTrack[];
}

// Template variable presets for common use cases
const COMMON_VARIABLES: Record<string, TemplateVariable[]> = {
  motivation: [
    { key: 'title', label: 'Title', type: 'text', placeholder: 'Your main message', required: true },
    { key: 'script', label: 'Script', type: 'textarea', placeholder: 'Your motivational speech...', required: true },
    { key: 'author', label: 'Author Name', type: 'text', placeholder: 'Author or source', required: false },
    { key: 'backgroundImage', label: 'Background Image', type: 'image', required: false },
    { key: 'backgroundMusic', label: 'Background Music', type: 'audio', required: false },
  ],
  food: [
    { key: 'dishName', label: 'Dish Name', type: 'text', placeholder: 'Name of the dish', required: true },
    { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Describe the dish...', required: true },
    { key: 'ingredients', label: 'Ingredients', type: 'textarea', placeholder: 'List ingredients...', required: false },
    { key: 'steps', label: 'Steps', type: 'textarea', placeholder: 'Cooking steps...', required: false },
    { key: 'foodImages', label: 'Food Images', type: 'image', required: true },
    { key: 'backgroundMusic', label: 'Background Music', type: 'audio', required: false },
  ],
  tutorial: [
    { key: 'topic', label: 'Topic', type: 'text', placeholder: 'What are you teaching?', required: true },
    { key: 'introduction', label: 'Introduction', type: 'textarea', placeholder: 'Intro to the topic...', required: true },
    { key: 'keyPoints', label: 'Key Points', type: 'textarea', placeholder: 'Main points to cover...', required: true },
    { key: 'conclusion', label: 'Conclusion', type: 'textarea', placeholder: 'Summary...', required: false },
    { key: 'visualAid', label: 'Visual Aid Image', type: 'image', required: false },
    { key: 'backgroundMusic', label: 'Background Music', type: 'audio', required: false },
  ],
  business: [
    { key: 'companyName', label: 'Company Name', type: 'text', placeholder: 'Your company', required: true },
    { key: 'pitch', label: 'Pitch', type: 'textarea', placeholder: 'Your business pitch...', required: true },
    { key: 'keyMetric', label: 'Key Metric', type: 'text', placeholder: 'e.g., 1M users', required: false },
    { key: 'cta', label: 'Call to Action', type: 'text', placeholder: 'Visit our website...', required: true },
    { key: 'logo', label: 'Logo', type: 'image', required: false },
    { key: 'backgroundMusic', label: 'Background Music', type: 'audio', required: false },
  ],
  lifestyle: [
    { key: 'title', label: 'Title', type: 'text', placeholder: 'Video title', required: true },
    { key: 'narrative', label: 'Narrative', type: 'textarea', placeholder: 'Your story...', required: true },
    { key: 'images', label: 'Images', type: 'image', required: true },
    { key: 'backgroundMusic', label: 'Background Music', type: 'audio', required: false },
  ],
};

// Default audio tracks (placeholder URLs - would need actual audio files)
const DEFAULT_MOTIVATION_AUDIO: AudioTrack[] = [
  {
    id: 'bg-music',
    name: 'Background Music',
    src: '', // Would be filled by user or AI
    volume: 0.3,
    startTime: 0,
    fadeIn: 2,
    fadeOut: 2,
    loop: true,
    muted: false,
  },
];

// =============================================================================
// PUBLIC TEMPLATES
// =============================================================================

export const PUBLIC_TEMPLATES: VideoTemplate[] = [
  {
    id: 'motivation-speech',
    name: 'Motivational Speech',
    description: 'Inspiring video with quote, text overlay, and dynamic animations',
    category: 'motivation',
    thumbnail: '/templates/motivation-thumb.jpg',
    videoMeta: {
      aspectRatio: '9:16',
      theme: 'bold_vibrant',
      fps: 30,
      audioTracks: DEFAULT_MOTIVATION_AUDIO,
    },
    blocks: [
      // Intro - Title slide
      {
        type: 'gradient-text',
        content: '{{title}}',
        gradientColors: ['#FF6B6B', '#FFE66D'],
        fontSize: 72,
        verticalAlign: 'center',
        horizontalAlign: 'center',
        enterAnimation: 'zoom',
        animationDuration: 0.8,
      } as ContentBlock,
      // Main quote
      {
        type: 'quote',
        text: '{{script}}',
        author: '{{author}}',
        verticalAlign: 'center',
        horizontalAlign: 'center',
        backgroundColor: 'rgba(0,0,0,0.7)',
        padding: 40,
        enterAnimation: 'fade',
        animationDuration: 0.5,
      } as ContentBlock,
      // Background image with text
      {
        type: 'motivational-image',
        src: '{{backgroundImage}}',
        overlayText: '{{title}}',
        overlayOpacity: 0.6,
        verticalAlign: 'center',
        horizontalAlign: 'center',
        enterAnimation: 'slide-up',
        animationDuration: 0.6,
      } as ContentBlock,
      // Call to action
      {
        type: 'cta',
        title: 'Share This Message',
        subtitle: 'Inspire others today',
        buttonText: 'Learn More',
        buttonUrl: 'https://example.com',
        verticalAlign: 'center',
        horizontalAlign: 'center',
        enterAnimation: 'fade',
        animationDuration: 0.5,
      } as ContentBlock,
    ],
    requiredVariables: COMMON_VARIABLES.motivation,
  },
  {
    id: 'food-vlog',
    name: 'Food Vlog',
    description: 'Showcase delicious food with multiple image slides and descriptions',
    category: 'food',
    thumbnail: '/templates/food-thumb.jpg',
    videoMeta: {
      aspectRatio: '16:9',
      theme: 'light_minimal',
      fps: 30,
    },
    blocks: [
      // Title card
      {
        type: 'text',
        content: '{{dishName}}',
        emphasis: 'high',
        verticalAlign: 'center',
        horizontalAlign: 'center',
        backgroundColor: '#FFF5E6',
        fontSize: 64,
        enterAnimation: 'slide-up',
        animationDuration: 0.6,
      } as ContentBlock,
      // Description
      {
        type: 'callout',
        title: '{{dishName}}',
        content: '{{description}}',
        variant: 'default',
        verticalAlign: 'center',
        horizontalAlign: 'center',
        backgroundColor: '#FFF',
        borderColor: '#FF6B6B',
        borderWidth: 2,
        borderRadius: 12,
        padding: 30,
        enterAnimation: 'fade',
        animationDuration: 0.5,
      } as ContentBlock,
      // Image gallery (multiple image blocks)
      {
        type: 'image',
        src: '{{foodImages}}',
        alt: '{{dishName}}',
        caption: '{{description}}',
        verticalAlign: 'center',
        horizontalAlign: 'center',
        enterAnimation: 'zoom',
        animationDuration: 0.8,
      } as ContentBlock,
      // Ingredients list
      {
        type: 'list',
        title: 'Ingredients',
        items: '{{ingredients}}'.split('\n').filter(Boolean),
        style: 'bullet',
        verticalAlign: 'center',
        horizontalAlign: 'left',
        backgroundColor: '#FFF9E6',
        enterAnimation: 'slide-left',
        animationDuration: 0.5,
      } as ContentBlock,
      // Steps
      {
        type: 'timeline',
        title: 'How to Make',
        events: '{{steps}}'.split('\n').map((step, i) => ({
          year: `Step ${i + 1}`,
          title: step.trim(),
          description: '',
        })),
        verticalAlign: 'center',
        horizontalAlign: 'left',
        enterAnimation: 'fade',
        animationDuration: 0.5,
      } as ContentBlock,
      // Outro
      {
        type: 'text',
        content: 'Enjoy your meal!',
        emphasis: 'medium',
        verticalAlign: 'center',
        horizontalAlign: 'center',
        backgroundColor: '#FF6B6B',
        fontSize: 48,
        enterAnimation: 'bounce',
        animationDuration: 0.6,
      } as ContentBlock,
    ],
    requiredVariables: COMMON_VARIABLES.food,
  },
  {
    id: 'tutorial',
    name: 'Tutorial / Educational',
    description: 'Educational video with key points, visuals, and clear structure',
    category: 'tutorial',
    thumbnail: '/templates/tutorial-thumb.jpg',
    videoMeta: {
      aspectRatio: '16:9',
      theme: 'corporate',
      fps: 30,
    },
    blocks: [
      // Intro title
      {
        type: 'text',
        content: '{{topic}}',
        emphasis: 'high',
        verticalAlign: 'center',
        horizontalAlign: 'center',
        backgroundColor: '#1E3A5F',
        fontSize: 56,
        enterAnimation: 'slide-up',
        animationDuration: 0.6,
      } as ContentBlock,
      // Introduction
      {
        type: 'callout',
        title: 'Introduction',
        content: '{{introduction}}',
        variant: 'default',
        verticalAlign: 'top',
        horizontalAlign: 'left',
        backgroundColor: '#F8FAFC',
        enterAnimation: 'fade',
        animationDuration: 0.5,
      } as ContentBlock,
      // Visual aid
      {
        type: 'image',
        src: '{{visualAid}}',
        alt: '{{topic}}',
        caption: 'Visual Guide',
        verticalAlign: 'center',
        horizontalAlign: 'center',
        enterAnimation: 'zoom',
        animationDuration: 0.8,
      } as ContentBlock,
      // Key points with icons
      {
        type: 'icon-list',
        title: 'Key Points',
        items: '{{keyPoints}}'.split('\n').filter(Boolean).map((point, i) => ({
          icon: ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'][i] || '✅',
          title: point.trim(),
          description: '',
        })),
        verticalAlign: 'center',
        horizontalAlign: 'left',
        backgroundColor: '#EFF6FF',
        enterAnimation: 'slide-right',
        animationDuration: 0.5,
      } as ContentBlock,
      // Stat/progress (learning metric)
      {
        type: 'progress-bar',
        title: 'Progress',
        progress: 100,
        showPercentage: true,
        verticalAlign: 'center',
        horizontalAlign: 'center',
        enterAnimation: 'fade',
        animationDuration: 0.5,
      } as ContentBlock,
      // Conclusion
      {
        type: 'quote',
        text: '{{conclusion}}',
        author: 'Summary',
        verticalAlign: 'center',
        horizontalAlign: 'center',
        backgroundColor: '#1E3A5F',
        padding: 40,
        enterAnimation: 'fade',
        animationDuration: 0.5,
      } as ContentBlock,
    ],
    requiredVariables: COMMON_VARIABLES.tutorial,
  },
  {
    id: 'business-pitch',
    name: 'Business Pitch',
    description: 'Professional pitch deck with stats, comparison, and call to action',
    category: 'business',
    thumbnail: '/templates/business-thumb.jpg',
    videoMeta: {
      aspectRatio: '16:9',
      theme: 'dark_modern',
      fps: 30,
    },
    blocks: [
      // Company name
      {
        type: 'text',
        content: '{{companyName}}',
        emphasis: 'high',
        verticalAlign: 'center',
        horizontalAlign: 'center',
        backgroundColor: '#0F172A',
        fontSize: 64,
        enterAnimation: 'zoom',
        animationDuration: 0.8,
      } as ContentBlock,
      // Logo
      {
        type: 'image',
        src: '{{logo}}',
        alt: '{{companyName}} Logo',
        verticalAlign: 'center',
        horizontalAlign: 'center',
        enterAnimation: 'fade',
        animationDuration: 0.5,
      } as ContentBlock,
      // Pitch text
      {
        type: 'text',
        content: '{{pitch}}',
        emphasis: 'medium',
        verticalAlign: 'center',
        horizontalAlign: 'center',
        backgroundColor: '#1E293B',
        fontSize: 36,
        enterAnimation: 'slide-up',
        animationDuration: 0.6,
      } as ContentBlock,
      // Key metric
      {
        type: 'stat',
        heading: 'Key Metric',
        value: '{{keyMetric}}',
        subtext: 'and growing',
        verticalAlign: 'center',
        horizontalAlign: 'center',
        backgroundColor: '#3B82F6',
        enterAnimation: 'bounce',
        animationDuration: 0.6,
      } as ContentBlock,
      // Comparison
      {
        type: 'comparison',
        title: 'Why Us?',
        items: [
          { label: 'Us', value: 85, color: '#3B82F6' },
          { label: 'Others', value: 45, color: '#94A3B8' },
        ],
        verticalAlign: 'center',
        horizontalAlign: 'center',
        enterAnimation: 'fade',
        animationDuration: 0.5,
      } as ContentBlock,
      // CTA
      {
        type: 'cta',
        title: '{{cta}}',
        subtitle: '{{companyName}}',
        buttonText: 'Get Started',
        buttonUrl: 'https://example.com',
        variant: 'primary',
        verticalAlign: 'center',
        horizontalAlign: 'center',
        enterAnimation: 'fade',
        animationDuration: 0.5,
      } as ContentBlock,
    ],
    requiredVariables: COMMON_VARIABLES.business,
  },
  {
    id: 'lifestyle-vlog',
    name: 'Lifestyle Vlog',
    description: 'Personal vlog style with narrative, images, and casual feel',
    category: 'lifestyle',
    thumbnail: '/templates/lifestyle-thumb.jpg',
    videoMeta: {
      aspectRatio: '9:16',
      theme: 'light_minimal',
      fps: 30,
    },
    blocks: [
      // Title
      {
        type: 'text',
        content: '{{title}}',
        emphasis: 'high',
        verticalAlign: 'center',
        horizontalAlign: 'center',
        backgroundColor: 'rgba(255,255,255,0.9)',
        fontSize: 48,
        enterAnimation: 'slide-up',
        animationDuration: 0.6,
      } as ContentBlock,
      // Image
      {
        type: 'image',
        src: '{{images}}',
        alt: '{{title}}',
        verticalAlign: 'center',
        horizontalAlign: 'center',
        enterAnimation: 'fade',
        animationDuration: 0.8,
      } as ContentBlock,
      // Narrative
      {
        type: 'quote',
        text: '{{narrative}}',
        author: '',
        verticalAlign: 'center',
        horizontalAlign: 'center',
        backgroundColor: 'rgba(0,0,0,0.6)',
        padding: 30,
        enterAnimation: 'fade',
        animationDuration: 0.5,
      } as ContentBlock,
      // More images (placeholder)
      {
        type: 'image',
        src: '{{images}}',
        alt: 'Moment',
        verticalAlign: 'center',
        horizontalAlign: 'center',
        enterAnimation: 'zoom',
        animationDuration: 0.8,
      } as ContentBlock,
      // Closing thought
      {
        type: 'text',
        content: 'Thanks for watching!',
        emphasis: 'medium',
        verticalAlign: 'center',
        horizontalAlign: 'center',
        backgroundColor: '#FFE4E6',
        fontSize: 36,
        enterAnimation: 'bounce',
        animationDuration: 0.6,
      } as ContentBlock,
    ],
    requiredVariables: COMMON_VARIABLES.lifestyle,
  },
];

/**
 * Get template by ID
 */
export function getTemplateById(id: string): VideoTemplate | undefined {
  return PUBLIC_TEMPLATES.find(t => t.id === id);
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: VideoTemplate['category']): VideoTemplate[] {
  return PUBLIC_TEMPLATES.filter(t => t.category === category);
}

/**
 * Resolve template variables - replace {{variable}} placeholders with actual values
 */
export function resolveTemplateVariables(
  blocks: ContentBlock[],
  values: Record<string, string>
): ContentBlock[] {
  return blocks.map(block => {
    const resolved = { ...block } as Record<string, unknown>;

    // Replace all string values that contain {{variable}} patterns
    Object.keys(resolved).forEach(key => {
      const value = resolved[key];
      if (typeof value === 'string') {
        let resolvedValue = value;
        Object.entries(values).forEach(([varKey, varValue]) => {
          resolvedValue = resolvedValue.replace(new RegExp(`{{${varKey}}}`, 'g'), varValue || '');
        });
        (resolved as Record<string, unknown>)[key] = resolvedValue;
      }
    });

    return resolved as ContentBlock;
  });
}