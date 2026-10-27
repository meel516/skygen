import { z } from 'zod';

// ============================================================================
// DATA LAYER - Input Schemas
// ============================================================================

/**
 * Intro/Outro configuration schema
 */
export const IntroOutroSchema = z.object({
  title: z.string().max(100).optional(),
  subtitle: z.string().max(200).optional(),
  logoUrl: z.string().url().optional(),
  duration: z.number().min(1).max(5).optional().default(2),
});

export type IntroOutroConfig = z.infer<typeof IntroOutroSchema>;

/**
 * Per-element override schema — used by the sub-element editor overlay.
 * Each block can have a map of element-id → override. The element-id is a
 * DOM-path string computed at click time (see src/lib/editor/element-path.ts).
 * Stored in composition pixels (1920×1080 space) so they scale uniformly.
 */
export const ElementOverrideSchema = z.object({
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  color: z.string().optional(),
  fontSize: z.number().optional(),
  fontWeight: z.union([z.string(), z.number()]).optional(),
  textAlign: z.enum(['left', 'center', 'right', 'justify']).optional(),
  src: z.string().optional(),
});

export type ElementOverride = z.infer<typeof ElementOverrideSchema>;

/**
 * Block customization schema - common styling options for all blocks
 */
export const BlockCustomizationSchema = z.object({
  // Position/Alignment settings
  verticalAlign: z.enum(['top', 'center', 'bottom']).default('center'),
  horizontalAlign: z.enum(['left', 'center', 'right']).default('center'),

  // Animation settings
  enterAnimation: z.enum(['fade', 'slide-up', 'slide-down', 'slide-left', 'slide-right', 'zoom', 'bounce', 'rotate', 'flip', 'none']).default('fade'),
  exitAnimation: z.enum(['fade', 'slide-up', 'slide-down', 'slide-left', 'slide-right', 'zoom', 'bounce', 'rotate', 'flip', 'none']).default('fade'),
  animationDuration: z.number().min(0.1).max(2).default(0.5),

  // Background settings
  backgroundColor: z.string().optional(),
  backgroundImage: z.string().optional(),
  backgroundBlur: z.number().min(0).max(20).default(0),

  // Border settings
  borderColor: z.string().optional(),
  borderWidth: z.number().min(0).max(10).default(0),
  borderRadius: z.number().min(0).max(100).default(0),
  shadowEnabled: z.boolean().default(false),
  shadowColor: z.string().default('rgba(0,0,0,0.5)'),
  shadowBlur: z.number().min(0).max(50).default(20),

  // Spacing settings
  padding: z.number().min(0).max(100).optional(),
  margin: z.number().min(0).max(50).default(0),

  // Audio narration (TTS)
  audioSrc: z.string().optional(),

  // Per-element overrides (sub-element editor overlay)
  elementOverrides: z.record(z.string(), ElementOverrideSchema).optional(),
});

export type BlockCustomization = z.infer<typeof BlockCustomizationSchema>;

/**
 * Audio Track schema for multi-track audio support
 */
export const AudioTrackSchema = z.object({
  id: z.string().min(1),
  name: z.string().max(100).default('Audio Track'),
  src: z.string().min(1), // URL or file path to audio file
  volume: z.number().min(0).max(1).default(0.7), // Volume level 0-1
  startTime: z.number().min(0).default(0), // When audio starts in the video timeline (seconds)
  fadeIn: z.number().min(0).max(10).default(0), // Fade in duration in seconds
  fadeOut: z.number().min(0).max(10).default(0), // Fade out duration in seconds
  loop: z.boolean().default(true), // Whether to loop the audio
  muted: z.boolean().default(false), // Whether the track is muted
});

export type AudioTrack = z.infer<typeof AudioTrackSchema>;

/**
 * Video metadata schema
 */
export const VideoMetaSchema = z.object({
  aspectRatio: z.enum(['16:9', '9:16', '1:1', '4:5']).default('9:16'),
  theme: z.enum(['dark_modern', 'light_minimal', 'bold_vibrant', 'corporate']).default('dark_modern'),
  fps: z.number().int().min(24).max(60).default(30),
  intro: IntroOutroSchema.optional(),
  outro: IntroOutroSchema.optional(),
  audioTracks: z.array(AudioTrackSchema).optional().default([]),
  subtitleTrack: z.lazy(() => SubtitleTrackSchema).optional(),
  textOverlayTracks: z.lazy(() => z.array(TextOverlayTrackSchema)).optional().default([]),
});

export type VideoMeta = z.infer<typeof VideoMetaSchema>;

/**
 * Stat content block schema
 */
export const StatBlockSchema = z.object({
  type: z.literal('stat'),
  heading: z.string().min(1).max(100),
  value: z.string().min(1).max(50),
  subtext: z.string().optional(),
}).merge(BlockCustomizationSchema);

export type StatBlock = z.infer<typeof StatBlockSchema>;

/**
 * Comparison item schema
 */
export const ComparisonItemSchema = z.object({
  label: z.string().min(1).max(50),
  value: z.number().min(0),
  color: z.string().optional(),
});

export type ComparisonItem = z.infer<typeof ComparisonItemSchema>;

/**
 * Comparison content block schema
 */
export const ComparisonBlockSchema = z.object({
  type: z.literal('comparison'),
  title: z.string().min(1).max(100).optional(),
  items: z.array(ComparisonItemSchema).min(2).max(6),
}).merge(BlockCustomizationSchema);

export type ComparisonBlock = z.infer<typeof ComparisonBlockSchema>;

/**
 * Text content block schema
 */
export const TextBlockSchema = z.object({
  type: z.literal('text'),
  content: z.string().min(1).max(500),
  emphasis: z.enum(['low', 'medium', 'high']).optional(),
}).merge(BlockCustomizationSchema);

export type TextBlock = z.infer<typeof TextBlockSchema>;

/**
 * Image content block schema
 */
export const ImageBlockSchema = z.object({
  type: z.literal('image'),
  src: z.string().url(),
  alt: z.string().max(200).optional(),
  caption: z.string().max(100).optional(),
}).merge(BlockCustomizationSchema);

export type ImageBlock = z.infer<typeof ImageBlockSchema>;

/**
 * Quote content block schema
 */
export const QuoteBlockSchema = z.object({
  type: z.literal('quote'),
  text: z.string().min(1).max(300),
  author: z.string().max(100).optional(),
}).merge(BlockCustomizationSchema);

export type QuoteBlock = z.infer<typeof QuoteBlockSchema>;

/**
 * List content block schema
 */
export const ListBlockSchema = z.object({
  type: z.literal('list'),
  title: z.string().min(1).max(100).optional(),
  items: z.array(z.string().min(1).max(200)).min(1).max(10),
  style: z.enum(['bullet', 'numbered', 'checkmarks']).optional().default('bullet'),
}).merge(BlockCustomizationSchema);

export type ListBlock = z.infer<typeof ListBlockSchema>;

/**
 * Timeline event schema
 */
export const TimelineEventSchema = z.object({
  year: z.string().max(20),
  title: z.string().min(1).max(100),
  description: z.string().max(200).optional(),
});

export type TimelineEvent = z.infer<typeof TimelineEventSchema>;

/**
 * Timeline content block schema
 */
export const TimelineBlockSchema = z.object({
  type: z.literal('timeline'),
  title: z.string().min(1).max(100).optional(),
  events: z.array(TimelineEventSchema).min(2).max(8),
}).merge(BlockCustomizationSchema);

export type TimelineBlock = z.infer<typeof TimelineBlockSchema>;

/**
 * Callout content block schema
 */
export const CalloutBlockSchema = z.object({
  type: z.literal('callout'),
  title: z.string().min(1).max(100),
  content: z.string().min(1).max(300),
  variant: z.enum(['success', 'warning', 'info', 'default']).optional().default('default'),
}).merge(BlockCustomizationSchema);

export type CalloutBlock = z.infer<typeof CalloutBlockSchema>;

/**
 * Icon item schema for icon-list
 */
export const IconItemSchema = z.object({
  icon: z.string().min(1).max(50),
  title: z.string().min(1).max(100),
  description: z.string().max(200).optional(),
});

export type IconItem = z.infer<typeof IconItemSchema>;

/**
 * Icon List content block schema
 */
export const IconListBlockSchema = z.object({
  type: z.literal('icon-list'),
  title: z.string().min(1).max(100).optional(),
  items: z.array(IconItemSchema).min(1).max(6),
}).merge(BlockCustomizationSchema);

export type IconListBlock = z.infer<typeof IconListBlockSchema>;

/**
 * Line Chart content block schema
 */
export const LineChartBlockSchema = z.object({
  type: z.literal('line-chart'),
  title: z.string().min(1).max(100).optional(),
  subtitle: z.string().max(200).optional(),
  data: z.array(z.number()).min(2).max(24),
  labels: z.array(z.string().max(20)).min(2).max(24).optional(),
  xAxisLabel: z.string().max(50).optional(),
  yAxisLabel: z.string().max(50).optional(),
  unit: z.string().max(10).optional(),
  showDataLabels: z.boolean().optional().default(false),
  lineColor: z.string().optional(),
}).merge(BlockCustomizationSchema);

export type LineChartBlock = z.infer<typeof LineChartBlockSchema>;

/**
 * Pie Chart segment schema
 */
export const PieSegmentSchema = z.object({
  label: z.string().min(1).max(50),
  value: z.number().min(0),
  color: z.string().optional(),
});

export type PieSegment = z.infer<typeof PieSegmentSchema>;

/**
 * Pie Chart content block schema
 */
export const PieChartBlockSchema = z.object({
  type: z.literal('pie-chart'),
  title: z.string().min(1).max(100).optional(),
  subtitle: z.string().max(200).optional(),
  segments: z.array(PieSegmentSchema).min(2).max(8),
  showPercentage: z.boolean().optional().default(true),
  showLegend: z.boolean().optional().default(true),
}).merge(BlockCustomizationSchema);

export type PieChartBlock = z.infer<typeof PieChartBlockSchema>;

/**
 * Code content block schema
 */
export const CodeBlockSchema = z.object({
  type: z.literal('code'),
  code: z.string().min(1).max(2000),
  language: z.string().max(50).optional().default('javascript'),
  title: z.string().max(100).optional(),
}).merge(BlockCustomizationSchema);

export type CodeBlock = z.infer<typeof CodeBlockSchema>;

/**
 * Testimonial content block schema
 */
export const TestimonialBlockSchema = z.object({
  type: z.literal('testimonial'),
  quote: z.string().min(1).max(400),
  author: z.string().min(1).max(100),
  role: z.string().max(100).optional(),
  company: z.string().max(100).optional(),
  avatar: z.string().url().optional(),
}).merge(BlockCustomizationSchema);

export type TestimonialBlock = z.infer<typeof TestimonialBlockSchema>;

// ============================================================================
// WHATSAPP CHAT BLOCK SCHEMA
// ============================================================================

/**
 * WhatsApp chat participant schema
 */
export const WhatsAppParticipantSchema = z.object({
  name: z.string().min(1).max(50),
  avatar: z.string().optional(), // URL or placeholder
  isOnline: z.boolean().optional().default(true),
});

export type WhatsAppParticipant = z.infer<typeof WhatsAppParticipantSchema>;

/**
 * WhatsApp chat message schema
 */
export const WhatsAppMessageSchema = z.object({
  from: z.enum(['person1', 'person2']), // person1 = sender (right/green), person2 = receiver (left/white)
  text: z.string().min(1).max(500),
  time: z.string().max(20).optional(), // e.g., "10:30 AM"
  showReadReceipt: z.boolean().optional().default(true),
});

export type WhatsAppMessage = z.infer<typeof WhatsAppMessageSchema>;

/**
 * WhatsApp chat content block schema
 */
export const WhatsAppChatBlockSchema = z.object({
  type: z.literal('whatsapp-chat'),
  title: z.string().min(1).max(100).optional(), // Chat title/header override
  person1: WhatsAppParticipantSchema, // "You" - sender (right side, green bubbles)
  person2: WhatsAppParticipantSchema, // Other person (left side, white bubbles)
  messages: z.array(WhatsAppMessageSchema).min(1).max(50), // Up to 50 messages supported
  showTypingIndicator: z.boolean().optional().default(true), // Show typing before first message
  lastSeen: z.string().max(50).optional(), // e.g., "last seen today at 10:30 AM"
}).merge(BlockCustomizationSchema);

export type WhatsAppChatBlock = z.infer<typeof WhatsAppChatBlockSchema>;

// ============================================================================
// MOTIVATIONAL IMAGE BLOCK SCHEMA (Image with Text Overlay)
// ============================================================================

/**
 * Text overlay schema for motivational images
 */
export const TextOverlaySchema = z.object({
  text: z.string().min(1).max(500),
  position: z.enum(['top', 'center', 'bottom', 'custom']).default('center'),
  customPosition: z.object({
    x: z.number().min(0).max(100).optional(), // Percentage from left
    y: z.number().min(0).max(100).optional(), // Percentage from top
  }).optional(),
  fontSize: z.enum(['small', 'medium', 'large', 'xlarge', 'xxlarge']).default('large'),
  fontWeight: z.enum(['normal', 'bold', 'black']).default('bold'),
  color: z.string().default('#FFFFFF'), // Text color
  shadow: z.boolean().default(true), // Text shadow for readability
  shadowColor: z.string().default('rgba(0,0,0,0.8)'),
  alignment: z.enum(['left', 'center', 'right']).default('center'),
  animation: z.enum([
    'none', 
    'fade', 
    'slide-up', 
    'slide-down', 
    'slide-left', 
    'slide-right',
    'zoom',
    'typewriter',
    'reveal'
  ]).default('fade'),
  animationDelay: z.number().min(0).max(5).default(0), // Delay before text animation starts
  stackOrder: z.number().int().min(0).max(10).optional(), // Order in stack (0 = top, higher = bottom)
});

export type TextOverlay = z.infer<typeof TextOverlaySchema>;

/**
 * Image animation effect types
 */
export const ImageEffectSchema = z.enum([
  'none',           // No animation
  'fade',           // Simple fade in
  'slide-up',       // Slide from bottom
  'slide-down',     // Slide from top
  'slide-left',     // Slide from right
  'slide-right',    // Slide from left
  'zoom-in',        // Zoom from small to normal
  'zoom-out',       // Zoom from large to normal
  'ken-burns',      // Slow zoom and pan (cinematic)
  'blur',           // Blur to clear
  'rotate',         // Rotate in
  'bounce',         // Bounce in
]);

export type ImageEffect = z.infer<typeof ImageEffectSchema>;

/**
 * Color overlay schema
 */
export const ColorOverlaySchema = z.object({
  enabled: z.boolean().default(false),
  color: z.string().default('#000000'),
  opacity: z.number().min(0).max(1).default(0.4), // 0 = transparent, 1 = solid
  animation: z.enum(['none', 'fade', 'pulse']).default('fade'),
});

export type ColorOverlay = z.infer<typeof ColorOverlaySchema>;

/**
 * Text style types for motivational images
 */
export const FontFamilySchema = z.enum([
  'inter',      // Inter (default, clean modern)
  'roboto',     // Roboto
  'montserrat', // Montserrat (bold, impactful)
  'oswald',     // Oswald (condensed, strong)
  'playfair',   // Playfair Display (elegant serif)
  'bebas',      // Bebas Neue (display, all-caps)
  'poppins',    // Poppins (friendly, rounded)
  'raleway',    // Raleway (thin, stylish)
]);
export type FontFamily = z.infer<typeof FontFamilySchema>;

export const TextStyleSchema = z.enum([
  'default',     // Simple fade in with shadow
  'quote',       // Italic with left border
  'typing',      // Typewriter effect
  'words',       // Word by word (slide+fade per word)
  'glow',        // Glowing text effect
  'outline',     // Outlined text (transparent fill)
  'bold-glow',   // Bold with glow
  'shadow',      // Drop shadow effect
  'shorts',       // YouTube Shorts: groups pop in with spring bounce + thick stroke
  'three-line',   // 3-line teleprompter: dim-top / COLORED-CENTER / dim-bottom
  'cinematic',    // Letter-spacing collapse + elegant fade from bottom
  'neon',         // Neon glow flicker entrance + pulse
  'karaoke',      // Group visible, each word highlights one by one (CapCut style)
  'karaoke-full', // All words visible at once, current word highlighted
]);

export type TextStyle = z.infer<typeof TextStyleSchema>;

/**
 * Subtitle Track — timed text entries rendered as a global overlay
 */
export const SubtitleEntrySchema = z.object({
  startTime: z.number().min(0),   // seconds from video start
  endTime:   z.number().min(0),   // seconds from video start
  text:      z.string().min(1).max(500),
});
export type SubtitleEntry = z.infer<typeof SubtitleEntrySchema>;

export const SubtitleStyleSchema = z.object({
  textStyle:          TextStyleSchema.default('shorts'),
  fontSize:           z.enum(['small', 'medium', 'large', 'xlarge', 'xxlarge']).default('large'),
  fontWeight:         z.enum(['normal', 'bold', 'black']).default('bold'),
  textColor:          z.string().default('#FFFFFF'),
  textPosition:       z.enum(['top', 'center', 'bottom']).default('bottom'),
  textAlign:          z.enum(['left', 'center', 'right']).default('center'),
  fontFamily:         FontFamilySchema.default('inter'),
  wordsPerGroup:      z.number().min(1).max(5).default(3),
  wordsPerSecond:     z.number().min(0.5).max(8).default(3),
  highlightColor:     z.string().default('#00FF88'),
  subtitleBackground: z.enum(['none', 'pill', 'bar']).default('none'),
});
export type SubtitleStyle = z.infer<typeof SubtitleStyleSchema>;

export const SubtitleTrackSchema = z.object({
  entries: z.array(SubtitleEntrySchema).min(1),
  style:   SubtitleStyleSchema.optional(),
  enabled: z.boolean().default(true),
});
export type SubtitleTrack = z.infer<typeof SubtitleTrackSchema>;

/**
 * Global Text Overlay Track — persistent text layer across the video
 * (watermarks, lower thirds, channel names, tickers, etc.)
 */
export const TextOverlayTrackSchema = z.object({
  id:                 z.string().min(1),
  text:               z.string().min(1).max(500),
  textStyle:          TextStyleSchema.default('default'),
  fontSize:           z.enum(['small', 'medium', 'large', 'xlarge', 'xxlarge']).default('medium'),
  fontWeight:         z.enum(['normal', 'bold', 'black']).default('normal'),
  textColor:          z.string().default('#FFFFFF'),
  textAlign:          z.enum(['left', 'center', 'right']).default('center'),
  textPosition:       z.enum(['top', 'center', 'bottom']).default('bottom'),
  fontFamily:         FontFamilySchema.default('inter'),
  opacity:            z.number().min(0).max(1).default(1),
  startTime:          z.number().min(0).default(0),        // seconds — when to start showing
  endTime:            z.number().min(0).nullable().default(null), // null = show until end
  enabled:            z.boolean().default(true),
  // Optional subtitle-style animation
  wordsPerGroup:      z.number().min(1).max(5).optional(),
  wordsPerSecond:     z.number().min(0.5).max(8).optional(),
  highlightColor:     z.string().optional(),
  subtitleBackground: z.enum(['none', 'pill', 'bar']).default('none'),
});
export type TextOverlayTrack = z.infer<typeof TextOverlayTrackSchema>;

/**
 * Motivational image content block schema
 * Simplified: Single text with different style options
 * Audio support: Optional background audio with duration control
 */
export const MotivationalImageBlockSchema = z.object({
  type: z.literal('motivational-image'),
  
  // Image source
  imageSrc: z.string().min(1),
  imageAlt: z.string().max(200).optional(),
  
  // Image animation effect
  imageEffect: ImageEffectSchema.default('fade'),
  imageEffectDuration: z.number().min(0.5).max(5).default(1.5),
  
  // Text — for subtitle styles (shorts/three-line), this IS the spoken script (same as audioSrc)
  text: z.string().min(1).max(1000).optional(),
  textStyle: TextStyleSchema.default('default'),
  fontSize: z.enum(['small', 'medium', 'large', 'xlarge', 'xxlarge']).default('xlarge'),
  fontWeight: z.enum(['normal', 'bold', 'black']).default('bold'),
  textColor: z.string().default('#FFFFFF'),
  textAlign: z.enum(['left', 'center', 'right']).default('center'),
  textPosition: z.enum(['top', 'center', 'bottom']).default('center'),
  textAnimationDelay: z.number().min(0).max(5).default(0.3),

  fontFamily: FontFamilySchema.default('inter'),

  // Subtitle-style options (for 'shorts', 'three-line' styles)
  wordsPerGroup: z.number().min(1).max(5).default(3),
  wordsPerSecond: z.number().min(0.5).max(8).default(3),
  highlightColor: z.string().default('#00FF88'),
  subtitleBackground: z.enum(['none', 'pill', 'bar']).default('none'),

  // Overlay type (replaces/extends colorOverlay)
  overlayType: z.enum(['none', 'solid', 'gradient-bottom', 'gradient-top', 'vignette']).default('gradient-bottom'),

  // Optional color overlay (legacy, kept for backwards compat)
  colorOverlay: ColorOverlaySchema.optional(),

  // Optional background color
  backgroundColor: z.string().default('#000000'),

  // Image fit options
  imageFit: z.enum(['cover', 'contain', 'fill']).default('cover'),
  imagePosition: z.enum(['center', 'top', 'bottom', 'left', 'right']).default('center'),

  // Audio support (optional)
  audioSrc: z.string().optional(),
  audioVolume: z.number().min(0).max(1).default(0.7),
  duration: z.number().min(1).max(120).optional(),
}).merge(BlockCustomizationSchema);

export type MotivationalImageBlock = z.infer<typeof MotivationalImageBlockSchema>;

// ============================================================================
// NEW ADVANCED BLOCK SCHEMAS
// ============================================================================

/**
 * Counter Block Schema - Animated counting numbers
 */
export const CounterBlockSchema = z.object({
  type: z.literal('counter'),
  label: z.string().max(100),
  from: z.number().default(0),
  to: z.number().default(100),
  duration: z.number().min(1).max(10).default(3),
  prefix: z.string().max(20).optional(),
  suffix: z.string().max(20).optional(),
  decimals: z.number().min(0).max(5).default(0),
  color: z.string().default('#3B82F6'),
  animationStyle: z.enum(['linear', 'easeOut', 'easeInOut', 'bounce']).default('easeOut'),
}).merge(BlockCustomizationSchema);

export type CounterBlock = z.infer<typeof CounterBlockSchema>;

/**
 * Progress Bar Block Schema
 */
export const ProgressBarBlockSchema = z.object({
  type: z.literal('progress-bar'),
  label: z.string().max(100).optional(),
  value: z.number().min(0).max(100).default(75),
  color: z.string().default('#10B981'),
  backgroundColor: z.string().default('#1F2937'),
  height: z.enum(['small', 'medium', 'large']).default('medium'),
  showPercentage: z.boolean().default(true),
  animated: z.boolean().default(true),
  stripes: z.boolean().default(false),
}).merge(BlockCustomizationSchema);

export type ProgressBarBlock = z.infer<typeof ProgressBarBlockSchema>;

/**
 * QR Code Block Schema
 */
export const QRCodeBlockSchema = z.object({
  type: z.literal('qr-code'),
  data: z.string().min(1).max(500),
  title: z.string().max(100).optional(),
  subtitle: z.string().max(200).optional(),
  size: z.enum(['small', 'medium', 'large']).default('medium'),
  fgColor: z.string().default('#000000'),
  bgColor: z.string().default('#FFFFFF'),
}).merge(BlockCustomizationSchema);

export type QRCodeBlock = z.infer<typeof QRCodeBlockSchema>;

/**
 * Video/GIF Block Schema
 */
export const VideoBlockSchema = z.object({
  type: z.literal('video'),
  src: z.string().default(''),
  autoPlay: z.boolean().default(true),
  loop: z.boolean().default(false),
  muted: z.boolean().default(true),
  controls: z.boolean().default(false),
  caption: z.string().max(200).optional(),

  // ── Optional text overlay (motivational-image style) ──
  text: z.string().max(1000).optional(),
  textStyle: TextStyleSchema.optional(),
  fontSize: z.enum(['small', 'medium', 'large', 'xlarge', 'xxlarge']).optional(),
  fontWeight: z.enum(['normal', 'bold', 'black']).optional(),
  textColor: z.string().optional(),
  textAlign: z.enum(['left', 'center', 'right']).optional(),
  textPosition: z.enum(['top', 'center', 'bottom']).optional(),
  textAnimationDelay: z.number().min(0).max(5).optional(),
  fontFamily: FontFamilySchema.optional(),

  // ── Word effects ──
  wordsPerGroup: z.number().min(1).max(5).optional(),
  wordsPerSecond: z.number().min(0.5).max(8).optional(),
  highlightColor: z.string().optional(),
  subtitleBackground: z.enum(['none', 'pill', 'bar']).optional(),

  // ── Overlay ──
  overlayType: z.enum(['none', 'solid', 'gradient-bottom', 'gradient-top', 'vignette']).optional(),
  colorOverlay: ColorOverlaySchema.optional(),

  // ── Video display ──
  videoFit: z.enum(['cover', 'contain', 'fill']).optional(),

  // ── Narration audio (TTS voice-over) ──
  audioSrc: z.string().optional(),
  audioVolume: z.number().min(0).max(1).optional(),

  // ── Audio overlay (separate from video audio & narration) ──
  overlayAudioSrc: z.string().optional(),
  overlayAudioVolume: z.number().min(0).max(1).optional(),
}).merge(BlockCustomizationSchema);

export type VideoBlock = z.infer<typeof VideoBlockSchema>;

/**
 * Avatar Grid Block Schema
 */
export const AvatarGridBlockSchema = z.object({
  type: z.literal('avatar-grid'),
  title: z.string().max(100).optional(),
  subtitle: z.string().max(200).optional(),
  avatars: z.array(z.object({
    name: z.string().max(50),
    role: z.string().max(100).optional(),
    image: z.string().optional(),
  })).min(1).max(12),
  layout: z.enum(['grid', 'carousel', 'stacked']).default('grid'),
  columns: z.number().min(2).max(6).default(3),
}).merge(BlockCustomizationSchema);

export type AvatarGridBlock = z.infer<typeof AvatarGridBlockSchema>;

/**
 * Social Stats Block Schema
 */
export const SocialStatsBlockSchema = z.object({
  type: z.literal('social-stats'),
  platform: z.enum(['twitter', 'instagram', 'youtube', 'tiktok', 'linkedin', 'facebook']),
  username: z.string().max(50),
  followers: z.number().min(0),
  posts: z.number().min(0).optional(),
  likes: z.number().min(0).optional(),
  verified: z.boolean().default(false),
  showGrowth: z.boolean().default(true),
  growthPercentage: z.number().optional(),
}).merge(BlockCustomizationSchema);

export type SocialStatsBlock = z.infer<typeof SocialStatsBlockSchema>;

/**
 * CTA Button Block Schema
 */
export const CTABlockSchema = z.object({
  type: z.literal('cta'),
  text: z.string().max(50),
  description: z.string().max(200).optional(),
  buttonStyle: z.enum(['primary', 'secondary', 'outline', 'ghost']).default('primary'),
  color: z.string().default('#3B82F6'),
  size: z.enum(['small', 'medium', 'large']).default('large'),
  icon: z.string().optional(),
  pulse: z.boolean().default(true),
}).merge(BlockCustomizationSchema);

export type CTABlock = z.infer<typeof CTABlockSchema>;

/**
 * Gradient Text Block Schema
 */
export const GradientTextBlockSchema = z.object({
  type: z.literal('gradient-text'),
  text: z.string().max(200),
  gradient: z.array(z.string()).min(2).max(5).default(['#3B82F6', '#8B5CF6']),
  angle: z.number().min(0).max(360).default(45),
  animate: z.boolean().default(true),
  animationSpeed: z.number().min(1).max(10).default(3),
  fontSize: z.enum(['small', 'medium', 'large', 'xlarge', 'xxlarge']).default('xlarge'),
  fontWeight: z.enum(['normal', 'bold', 'black']).default('bold'),
}).merge(BlockCustomizationSchema);

export type GradientTextBlock = z.infer<typeof GradientTextBlockSchema>;

/**
 * Animated Background Block Schema
 */
export const AnimatedBackgroundBlockSchema = z.object({
  type: z.literal('animated-bg'),
  style: z.enum(['particles', 'waves', 'gradient', 'noise', 'geometric', 'aurora']),
  primaryColor: z.string().default('#3B82F6'),
  secondaryColor: z.string().default('#8B5CF6'),
  speed: z.number().min(0.5).max(5).default(1),
  intensity: z.number().min(0.1).max(1).default(0.5),
  overlay: z.boolean().default(false),
  overlayOpacity: z.number().min(0).max(1).default(0.3),
}).merge(BlockCustomizationSchema);

export type AnimatedBackgroundBlock = z.infer<typeof AnimatedBackgroundBlockSchema>;

/**
 * Countdown Timer Block Schema
 */
export const CountdownBlockSchema = z.object({
  type: z.literal('countdown'),
  title: z.string().max(100).optional(),
  targetDate: z.string().optional(), // ISO date string
  days: z.number().min(0).optional(),
  hours: z.number().min(0).max(23).optional(),
  minutes: z.number().min(0).max(59).optional(),
  seconds: z.number().min(0).max(59).optional(),
  style: z.enum(['modern', 'classic', 'minimal', 'flip']).default('modern'),
  color: z.string().default('#FFFFFF'),
  showLabels: z.boolean().default(true),
}).merge(BlockCustomizationSchema);

export type CountdownBlock = z.infer<typeof CountdownBlockSchema>;

/**
 * Weather Block Schema - Weather widget with animated icons
 */
export const WeatherBlockSchema = z.object({
  type: z.literal('weather-block'),
  location: z.string().max(100).default('San Francisco'),
  temperature: z.number().default(72),
  unit: z.enum(['F', 'C']).default('F'),
  condition: z.enum(['sunny', 'partly-cloudy', 'cloudy', 'rainy', 'stormy', 'snowy', 'windy', 'foggy', 'night-clear', 'night-cloudy']).default('partly-cloudy'),
  description: z.string().max(100).optional(),
  humidity: z.number().min(0).max(100).default(65),
  windSpeed: z.number().min(0).default(12),
  highTemp: z.number().optional(),
  lowTemp: z.number().optional(),
  showForecast: z.boolean().default(true),
  showDetails: z.boolean().default(true),
  cardStyle: z.enum(['glass', 'solid', 'minimal', 'gradient']).default('glass'),
  accentColor: z.string().default('#38BDF8'),
  animateIcon: z.boolean().default(true),
}).merge(BlockCustomizationSchema);

export type WeatherBlock = z.infer<typeof WeatherBlockSchema>;

// ============================================================================
// 3D TOWER CHART BLOCK SCHEMA - 3D Ranking visualization with Three.js
// ============================================================================

/**
 * Tower item schema for 3D tower chart
 */
export const TowerItemSchema = z.object({
  rank: z.number().int().min(1),
  name: z.string().max(100),
  value: z.number().min(0),
  valueFormatted: z.string().max(50).optional(), // e.g., "155M", "$2.5B"
  color: z.string().optional(),
  image: z.string().optional(), // Optional image URL for the item
  subtitle: z.string().max(100).optional(), // e.g., "2009", "Nintendo"
});

export type TowerItem = z.infer<typeof TowerItemSchema>;

/**
 * 3D Tower Chart Block Schema - Ranking tower visualization
 */
export const TowerChart3DBlockSchema = z.object({
  type: z.literal('tower-chart-3d'),
  
  // Title and description
  title: z.string().max(100).default('Top Rankings'),
  subtitle: z.string().max(200).optional(),
  
  // Data - array of items to display (required, no presets)
  items: z.array(TowerItemSchema).min(1).max(50),
  
  // Visual settings
  towerStyle: z.enum(['boxes', 'cylinders', 'hexagons']).default('boxes'),
  towerSpacing: z.number().min(2).max(10).default(5), // Spacing between towers
  baseHeight: z.number().min(1).max(5).default(2), // Minimum height for smallest value
  maxHeight: z.number().min(10).max(50).default(25), // Maximum height for largest value
  
  // Colors
  gradientStart: z.string().default('#3B82F6'),
  gradientEnd: z.string().default('#8B5CF6'),
  useGradientByRank: z.boolean().default(true), // Color by rank position
  showValueLabels: z.boolean().default(true),
  showRankNumbers: z.boolean().default(true),
  
  // Camera animation
  cameraDistance: z.number().min(10).max(50).default(20),
  cameraPauseDuration: z.number().min(0.2).max(2).default(0.4), // Pause at each rank (seconds)
  cameraMoveSpeed: z.number().min(0.3).max(3).default(0.8), // Speed between ranks (seconds)
  cameraAngle: z.number().min(0).max(90).default(30), // Viewing angle (degrees)
  
  // Animation direction
  animationDirection: z.enum(['top-to-bottom', 'bottom-to-top']).default('top-to-bottom'), // Camera movement direction
  
  // Scene settings
  backgroundColor: z.string().default('#0a0a1a'),
  groundColor: z.string().default('#151525'),
  showGround: z.boolean().default(true),
  ambientIntensity: z.number().min(0.3).max(2).default(0.6),
  showLabels3D: z.boolean().default(true),
  
  // Background Preset - Built-in 3D environments
  backgroundPreset: z.enum([
    'none',             // No background, just stars
    'cyber-grid',       // Neon grid floor with glow
    'mountain-range',   // Distant mountain silhouettes
    'ocean-waves',      // Animated ocean/water plane
    'forest-trees',     // Stylized low-poly trees
    'city-skyline',     // Distant city buildings
    'abstract-waves',   // Abstract wave/mesh terrain
    'space-station',    // Space station interior feel
    // Advanced presets
    'aurora-borealis',  // Northern lights effect
    'volcanic-inferno', // Lava pools and volcanic environment
    'crystal-caves',    // Crystalline formations with reflections
    'desert-dunes',     // Sand dunes with heat shimmer
    'neon-tokyo',       // Cyberpunk Japanese city aesthetic
    'floating-islands', // Sky islands with waterfalls
    'deep-ocean',       // Underwater environment with bubbles
    'galaxy-nebula',    // Colorful space clouds
    'matrix-rain',      // Digital rain effect
    'ice-glacier',      // Frozen environment with ice formations
    'steampunk-gears',  // Industrial Victorian machinery
    'alien-planet',     // Extraterrestrial landscape
    'tron-grid',        // Iconic Tron-style light grid
    // Immersive Environment Presets - Towers appear WITHIN these
    'football-stadium', // Full stadium with field, towers on field
    'race-track',       // F1 style circuit with grandstands
    'concert-stage',    // Music festival with stage and lights
    'castle-grounds',   // Medieval castle with courtyard
    'airport-runway',   // Planes and terminal
    'theme-park',       // Amusement park with rides
    'ancient-ruins',    // Temple/pillars environment
    'zen-garden',       // Japanese peaceful garden
    'ski-resort',       // Snowy mountain slopes
    'vineyard',         // Rolling hills with grape vines
  ]).default('cyber-grid'),
  
  // Animation
  introAnimation: z.enum(['fade', 'zoom', 'slide-up', 'none']).default('fade'),
  itemRevealDelay: z.number().min(0).max(0.5).default(0.05), // Delay between item reveals
  
  // Custom 3D Model (optional GLB file path)
  customModelPath: z.string().optional(), // Path to custom GLB model in /models folder
  customModelPosition: z.object({
    x: z.number().default(0),
    y: z.number().default(35),
    z: z.number().default(-60),
  }).optional(),
  customModelScale: z.number().min(0.1).max(10).default(2),
  customModelRotation: z.number().min(0).max(360).default(0),
}).merge(BlockCustomizationSchema);

export type TowerChart3DBlock = z.infer<typeof TowerChart3DBlockSchema>;

// ============================================================================
// 3D BAR RACE CHART BLOCK SCHEMA - Dynamic horizontal bar race
// ============================================================================

/**
 * Bar Race item schema for time-series data
 */
export const BarRaceItemSchema = z.object({
  name: z.string().max(100),
  value: z.number().min(0),
  valueFormatted: z.string().max(50).optional(), // e.g., "155M", "$2.5B"
  color: z.string().optional(),
  image: z.string().optional(), // Optional image/flag URL
  data: z.array(z.number()).optional(), // Time-series data for animation (optional)
});

export type BarRaceItem = z.infer<typeof BarRaceItemSchema>;

/**
 * 3D Bar Race Chart Block Schema - Dynamic ranking visualization
 */
export const BarRace3DBlockSchema = z.object({
  type: z.literal('bar-race-3d'),
  
  // Title and description
  title: z.string().max(100).default('Bar Race'),
  subtitle: z.string().max(200).optional(),
  
  // Data - array of items with optional time-series
  items: z.array(BarRaceItemSchema).min(2).max(20),
  
  // Race settings
  raceDuration: z.number().min(1).max(30).default(10), // Total duration of the race animation
  barHeight: z.number().min(0.5).max(3).default(1.5), // Height of each bar
  barMaxWidth: z.number().min(10).max(50).default(30), // Maximum bar width (value)
  barSpacing: z.number().min(0.5).max(2).default(0.8), // Vertical spacing between bars
  barDepth: z.number().min(0.5).max(3).default(1.5), // Depth of each bar
  
  // Colors
  gradientStart: z.string().default('#3B82F6'),
  gradientEnd: z.string().default('#8B5CF6'),
  useGradientByValue: z.boolean().default(true), // Color by value magnitude
  
  // Labels
  showValueLabels: z.boolean().default(true),
  showNameLabels: z.boolean().default(true),
  showRankNumbers: z.boolean().default(true),
  
  // Animation
  animationDirection: z.enum(['top-to-bottom', 'bottom-to-top', 'winner-focus']).default('top-to-bottom'),
  positionTransitionSpeed: z.number().min(0.1).max(1).default(0.3), // Speed of position changes
  valueGrowSpeed: z.number().min(0.5).max(3).default(1), // Speed of value bar growing
  
  // Camera
  cameraDistance: z.number().min(10).max(50).default(25),
  cameraAngle: z.number().min(0).max(90).default(45),
  cameraFollowTop: z.number().min(1).max(10).default(5), // How many top items to keep in view
  
  // Scene
  backgroundColor: z.string().default('#0a0a1a'),
  groundColor: z.string().default('#151525'),
  showGround: z.boolean().default(true),
  ambientIntensity: z.number().min(0.3).max(2).default(0.6),
  
  // Background Preset
  backgroundPreset: z.enum([
    'none',
    'cyber-grid',
    'neon-tokyo',
    'tron-grid',
    'galaxy-nebula',
    'matrix-rain',
  ]).default('cyber-grid'),
  
  // Winner celebration
  showWinnerEffect: z.boolean().default(true),
  winnerDuration: z.number().min(0.5).max(3).default(1.5), // Duration of winner celebration
}).merge(BlockCustomizationSchema);

export type BarRace3DBlock = z.infer<typeof BarRace3DBlockSchema>;

// ============================================================================
// PARALLAX STORY BLOCK SCHEMA - Cinematic Multi-layer Parallax Storytelling
// ============================================================================

/**
 * Parallax layer schema - Each layer has its own depth and movement
 */
export const ParallaxLayerSchema = z.object({
  id: z.string().optional(), // Unique identifier
  name: z.string().max(50), // Layer name (e.g., "Foreground", "Trees", "Sky")
  image: z.string().min(1), // Image URL for this layer
  depth: z.number().min(0).max(100).default(50), // 0 = closest (moves most), 100 = farthest (moves least)
  parallaxFactor: z.number().min(0).max(5).default(1), // Multiplier for parallax effect
  cameraIntensity: z.number().min(0).max(2).default(1), // How much camera movement affects this layer (0 = static, 1 = normal, 2 = double)
  scale: z.number().min(0.5).max(3).default(1), // Initial scale of the layer
  opacity: z.number().min(0).max(1).default(1), // Layer opacity
  positionX: z.number().min(-100).max(100).default(0), // Horizontal offset (%)
  positionY: z.number().min(-100).max(100).default(0), // Vertical offset (%)
  rotation: z.number().min(-45).max(45).default(0), // Rotation in degrees
  blur: z.number().min(0).max(20).default(0), // Blur amount
  blendMode: z.enum(['normal', 'multiply', 'screen', 'overlay', 'lighten', 'darken']).default('normal'),
  // Individual layer motion controls
  motionEnabled: z.boolean().default(true), // Whether this layer has its own motion
  motionDirection: z.enum([
    'none', 'left', 'right', 'up', 'down', 
    'diagonal-tl-br', 'diagonal-tr-bl', 'diagonal-bl-tr', 'diagonal-br-tl',
    'zoom-in', 'zoom-out', 'rotate-cw', 'rotate-ccw', 'float', 'pulse'
  ]).default('right'),
  motionSpeed: z.number().min(0).max(5).default(1), // Speed of individual layer motion
  motionIntensity: z.number().min(0).max(3).default(1), // How much the layer moves
  motionOscillate: z.boolean().default(false), // Whether motion should oscillate back and forth
  motionOscillateSpeed: z.number().min(0.5).max(5).default(1), // Oscillation frequency
  // Animation settings per layer
  animationIn: z.enum(['none', 'fade', 'slide-left', 'slide-right', 'slide-up', 'slide-down', 'zoom-in', 'zoom-out', 'rotate-in', 'flip-x', 'flip-y', 'bounce', 'blur-in']).default('fade'),
  animationOut: z.enum(['none', 'fade', 'slide-left', 'slide-right', 'slide-up', 'slide-down', 'zoom-in', 'zoom-out', 'rotate-out', 'flip-x', 'flip-y', 'bounce']).default('fade'),
  animationDelay: z.number().min(0).max(5).default(0), // Delay before animation starts
  animationDuration: z.number().min(0.1).max(5).default(1), // Duration of entrance animation
  animationEasing: z.enum(['linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out', 'bounce', 'elastic']).default('ease-out'),
  // Image fit option - control whether image is cropped or not
  imageFit: z.enum(['cover', 'contain', 'fill']).default('cover'), // How image fits the layer
  imagePosition: z.enum(['center', 'top', 'bottom', 'left', 'right']).default('center'), // Image position when using contain
  removeBackground: z.boolean().default(false), // true = generate without background (transparent cut-out)
});

export type ParallaxLayer = z.infer<typeof ParallaxLayerSchema>;

/**
 * Camera movement types for parallax effect
 */
export const CameraMovementSchema = z.enum([
  'none',           // Static camera
  'pan-left',       // Camera pans left (layers move right at different speeds)
  'pan-right',      // Camera pans right (layers move left at different speeds)
  'pan-up',         // Camera pans up
  'pan-down',       // Camera pans down
  'zoom-in',        // Camera zooms in
  'zoom-out',       // Camera zooms out
  'diagonal-tl-br', // Diagonal pan top-left to bottom-right
  'diagonal-tr-bl', // Diagonal pan top-right to bottom-left
  'orbit',          // Circular/orbital camera movement
  'breathing',      // Subtle in-out breathing motion
  'custom',         // Custom keyframe-based movement
]);

export type CameraMovement = z.infer<typeof CameraMovementSchema>;

/**
 * Visual effects for parallax scenes
 */
export const ParallaxEffectSchema = z.enum([
  'none',
  'particles',      // Floating particles (dust, snow, leaves)
  'light-rays',     // God rays / volumetric light
  'fog',            // Atmospheric fog/mist
  'rain',           // Rain overlay
  'snow',           // Snowfall
  'bokeh',          // Bokeh light spots
  'film-grain',     // Vintage film grain
  'vignette',       // Darkened edges
  'chromatic',      // Chromatic aberration
  'glow',           // Glow/bloom effect
]);

export type ParallaxEffect = z.infer<typeof ParallaxEffectSchema>;

/**
 * Text overlay for storytelling
 */
export const StoryTextSchema = z.object({
  text: z.string().max(500),
  position: z.enum(['top', 'center', 'bottom', 'custom']).default('center'),
  customX: z.number().min(0).max(100).default(50), // Percentage
  customY: z.number().min(0).max(100).default(50), // Percentage
  fontSize: z.enum(['small', 'medium', 'large', 'xlarge', 'xxlarge']).default('large'),
  fontWeight: z.enum(['normal', 'bold', 'black']).default('bold'),
  color: z.string().default('#FFFFFF'),
  shadow: z.boolean().default(true),
  shadowColor: z.string().default('rgba(0,0,0,0.8)'),
  textAlign: z.enum(['left', 'center', 'right']).default('center'),
  animation: z.enum(['none', 'fade', 'slide-up', 'slide-down', 'typewriter', 'glow', 'pulse']).default('fade'),
  animationDelay: z.number().min(0).max(10).default(0.5),
  duration: z.number().min(0.5).max(30).default(3), // How long text stays visible
  startTime: z.number().min(0).max(60).default(0), // When text appears (seconds)
});

export type StoryText = z.infer<typeof StoryTextSchema>;

/**
 * Parallax Story Block Schema - Cinematic multi-layer storytelling
 */
export const ParallaxStoryBlockSchema = z.object({
  type: z.literal('parallax-story'),
  
  // Story title and metadata
  title: z.string().max(100).optional(),
  subtitle: z.string().max(200).optional(),
  
  // Parallax layers (ordered back to front)
  layers: z.array(ParallaxLayerSchema).min(1).max(10),
  
  // Camera settings
  cameraMovement: CameraMovementSchema.default('pan-right'),
  cameraSpeed: z.number().min(0.1).max(5).default(1), // Speed multiplier
  cameraIntensity: z.number().min(0).max(2).default(1), // How intense the movement is
  
  // Visual effects
  effects: z.array(ParallaxEffectSchema).default([]),
  effectIntensity: z.number().min(0).max(1).default(0.5),
  
  // Story text overlays (multiple text elements with timing)
  textOverlays: z.array(StoryTextSchema).optional(),
  
  // Overall text - single text with advanced styles (like motivational image)
  textMode: z.enum(['none', 'overlays', 'overall']).default('none'), // Which text mode to use
  text: z.string().max(500).optional(), // Main text for "overall" mode
  textStyle: TextStyleSchema.default('default'),
  textFontSize: z.enum(['small', 'medium', 'large', 'xlarge', 'xxlarge']).default('xlarge'),
  textFontWeight: z.enum(['normal', 'bold', 'black']).default('bold'),
  textColor: z.string().default('#FFFFFF'),
  textAlign: z.enum(['left', 'center', 'right']).default('center'),
  textPosition: z.enum(['top', 'center', 'bottom']).default('center'),
  textAnimationDelay: z.number().min(0).max(5).default(0.3),
  fontFamily: FontFamilySchema.default('inter'),
  wordsPerGroup: z.number().min(1).max(5).default(3),
  wordsPerSecond: z.number().min(0.5).max(8).default(3),
  highlightColor: z.string().default('#00FF88'),
  subtitleBackground: z.enum(['none', 'pill', 'bar']).default('none'),
  
  // Color grading
  colorGrade: z.enum(['none', 'cinematic', 'vintage', 'cold', 'warm', 'noir', 'sepia', 'neon']).default('none'),
  colorIntensity: z.number().min(0).max(1).default(0.5),
  
  // Background color (for letterboxing or blending)
  backgroundColor: z.string().default('#000000'),
  
  // Aspect ratio handling
  fitMode: z.enum(['cover', 'contain', 'stretch']).default('cover'),
  
  // Animation settings
  introDuration: z.number().min(0.5).max(3).default(1), // Fade in duration
  outroDuration: z.number().min(0.5).max(3).default(1), // Fade out duration
  loopAnimation: z.boolean().default(false), // Whether to loop camera movement
  
  // Depth of field simulation
  dofEnabled: z.boolean().default(false),
  dofFocusDepth: z.number().min(0).max(100).default(50), // Which depth level is in focus
  dofBlurAmount: z.number().min(0).max(10).default(2), // Blur intensity
  
  // 3D perspective settings
  perspective: z.number().min(500).max(3000).default(1000), // CSS perspective value
  perspectiveOriginX: z.number().min(0).max(100).default(50), // %
  perspectiveOriginY: z.number().min(0).max(100).default(50), // %
  
  // Audio support
  audioSrc: z.string().optional(), // URL to audio file (mp3, wav, etc.)
  audioVolume: z.number().min(0).max(1).default(0.7), // Volume level 0-1
  audioFadeIn: z.number().min(0).max(5).default(0.5), // Fade in duration in seconds
  audioFadeOut: z.number().min(0).max(5).default(0.5), // Fade out duration in seconds
  audioLoop: z.boolean().default(true), // Whether to loop audio
  audioStartTime: z.number().min(0).default(0), // When audio starts (seconds from video start)
  audioDelay: z.number().min(0).default(0), // Delay before audio starts playing (seconds from scene start)

}).merge(BlockCustomizationSchema);

export type ParallaxStoryBlock = z.infer<typeof ParallaxStoryBlockSchema>;

// ============================================================================
// TOP PLAYERS BLOCK SCHEMA - Countdown-style "Top N" with 3D depth camera zoom
// ============================================================================

/**
 * Individual player entry in a Top-Players block
 */
export const TopPlayersPlayerSchema = z.object({
  rank: z.number().int().min(1),
  name: z.string().max(100),
  image: z.string().optional(),              // URL (cutout) — generated via pipeline
  subtitle: z.string().max(200).optional(),  // e.g. "India • 13,000+ runs"
});

export type TopPlayersPlayer = z.infer<typeof TopPlayersPlayerSchema>;

/**
 * Top Players Block Schema - CSS 3D depth camera zoom countdown
 */
export const TopPlayersBlockSchema = z.object({
  type: z.literal('top-players'),

  // Title / description
  title: z.string().max(100).optional(),
  subtitle: z.string().max(200).optional(),

  // Shared background image (stadium / ground / arena)
  backgroundImage: z.string().optional(),

  // Reveal order: 'top-last' = countdown (#10 → #1), 'top-first' = #1 first
  revealOrder: z.enum(['top-first', 'top-last']).default('top-last'),

  // Player entries (3-10)
  players: z.array(TopPlayersPlayerSchema).min(3).max(10),

  // Duration overrides
  duration: z.number().min(3).max(120).optional(),
  defaultPerPlayerSeconds: z.number().min(1).max(10).default(3),
}).merge(BlockCustomizationSchema);

export type TopPlayersBlock = z.infer<typeof TopPlayersBlockSchema>;

/**
 * Pricing plan schema
 */
export const PricingPlanSchema = z.object({
  name: z.string().min(1).max(50),
  price: z.string().min(1).max(20),
  period: z.string().max(20).optional(),
  features: z.array(z.string().max(100)).min(1).max(8),
  highlighted: z.boolean().optional().default(false),
  ctaText: z.string().max(30).optional().default('Get Started'),
});

export const PricingTableBlockSchema = z.object({
  type: z.literal('pricing-table'),
  title: z.string().max(100).optional(),
  subtitle: z.string().max(200).optional(),
  plans: z.array(PricingPlanSchema).min(1).max(4),
}).merge(BlockCustomizationSchema);

export type PricingTableBlock = z.infer<typeof PricingTableBlockSchema>;

/**
 * Logo wall schema
 */
export const LogoItemSchema = z.object({
  src: z.string(),
  name: z.string().max(50),
});

export const LogoWallBlockSchema = z.object({
  type: z.literal('logo-wall'),
  title: z.string().max(100).optional(),
  subtitle: z.string().max(200).optional(),
  logos: z.array(LogoItemSchema).min(2).max(20),
  columns: z.number().min(2).max(5).optional().default(4),
}).merge(BlockCustomizationSchema);

export type LogoWallBlock = z.infer<typeof LogoWallBlockSchema>;

/**
 * Process steps schema
 */
export const ProcessStepSchema = z.object({
  number: z.number().min(1),
  title: z.string().min(1).max(80),
  description: z.string().max(200).optional(),
  icon: z.string().max(10).optional(),
});

export const ProcessStepsBlockSchema = z.object({
  type: z.literal('process-steps'),
  title: z.string().max(100).optional(),
  subtitle: z.string().max(200).optional(),
  steps: z.array(ProcessStepSchema).min(2).max(8),
}).merge(BlockCustomizationSchema);

export type ProcessStepsBlock = z.infer<typeof ProcessStepsBlockSchema>;

// ============================================================================
// HTML BLOCK SCHEMA - Custom HTML/CSS/JS rendered in iframe
// ============================================================================

export const HtmlBlockSchema = z.object({
  type: z.literal('html'),
  htmlContent: z.string().max(50000),
  title: z.string().max(100).optional(),
  backgroundColor: z.string().optional(),
}).merge(BlockCustomizationSchema);

export type HtmlBlock = z.infer<typeof HtmlBlockSchema>;

// ============================================================================
// DIAGRAM BLOCK SCHEMA - Flowcharts, hierarchies, sequences, mind maps, networks
// ============================================================================

export const DiagramNodeSchema = z.object({
  id: z.string().min(1).max(50),
  label: z.string().min(1).max(80),
  type: z.enum(['default', 'decision', 'start', 'end', 'process', 'data']).optional().default('default'),
  color: z.string().optional(),
});

export type DiagramNode = z.infer<typeof DiagramNodeSchema>;

export const DiagramEdgeSchema = z.object({
  from: z.string().min(1).max(50),
  to: z.string().min(1).max(50),
  label: z.string().max(50).optional(),
  style: z.enum(['solid', 'dashed', 'arrow']).optional().default('arrow'),
});

export type DiagramEdge = z.infer<typeof DiagramEdgeSchema>;

export const DiagramBlockSchema = z.object({
  type: z.literal('diagram'),
  diagramType: z.enum(['flowchart', 'hierarchy', 'sequence', 'mindmap', 'network']),
  title: z.string().max(100).optional(),
  nodes: z.array(DiagramNodeSchema).min(1).max(30),
  edges: z.array(DiagramEdgeSchema).min(0).max(50),
  layout: z.enum(['vertical', 'horizontal', 'radial']).optional().default('vertical'),
  templateId: z.string().max(100).optional(),
  primaryColor: z.string().optional(),
  backgroundColor: z.string().optional(),
}).merge(BlockCustomizationSchema);

export type DiagramBlock = z.infer<typeof DiagramBlockSchema>;

/**
 * Custom plugin block schema - represents any user-installed plugin
 */
export const CustomPluginBlockSchema = z.object({
  type: z.literal('custom-plugin'),
  pluginId: z.string().min(1),              // e.g. 'stat-block', 'my-custom-plugin'
  pluginData: z.record(z.string(), z.unknown()),  // plugin-specific props defined by schema.json
}).merge(BlockCustomizationSchema);

export type CustomPluginBlock = z.infer<typeof CustomPluginBlockSchema>;

/**
 * Union type for all content blocks
 */
export const ContentBlockSchema = z.discriminatedUnion('type', [
  StatBlockSchema,
  ComparisonBlockSchema,
  TextBlockSchema,
  ImageBlockSchema,
  QuoteBlockSchema,
  ListBlockSchema,
  TimelineBlockSchema,
  CalloutBlockSchema,
  IconListBlockSchema,
  LineChartBlockSchema,
  PieChartBlockSchema,
  CodeBlockSchema,
  TestimonialBlockSchema,
  WhatsAppChatBlockSchema,
  MotivationalImageBlockSchema,
  // New blocks
  CounterBlockSchema,
  ProgressBarBlockSchema,
  QRCodeBlockSchema,
  VideoBlockSchema,
  AvatarGridBlockSchema,
  SocialStatsBlockSchema,
  CTABlockSchema,
  GradientTextBlockSchema,
  AnimatedBackgroundBlockSchema,
  CountdownBlockSchema,
  WeatherBlockSchema,
  TowerChart3DBlockSchema,
  BarRace3DBlockSchema,
  ParallaxStoryBlockSchema,
  TopPlayersBlockSchema,
  PricingTableBlockSchema,
  LogoWallBlockSchema,
  ProcessStepsBlockSchema,
  HtmlBlockSchema,
  DiagramBlockSchema,
  // User plugin blocks
  CustomPluginBlockSchema,
]);

export type ContentBlock = z.infer<typeof ContentBlockSchema>;

/**
 * Complete video input schema
 */
export const VideoInputSchema = z.object({
  videoMeta: VideoMetaSchema,
  contentBlocks: z.array(ContentBlockSchema).min(1).max(20),
  sourceTemplateId: z.string().optional(),
});

export type VideoInput = z.infer<typeof VideoInputSchema>;

// ============================================================================
// INTELLIGENCE LAYER - AI Decision Schemas
// ============================================================================

/**
 * Motion profile types
 */
export const MotionProfileSchema = z.enum(['subtle', 'dynamic', 'energetic']);
export type MotionProfile = z.infer<typeof MotionProfileSchema>;

/**
 * Animation sequence phases
 */
export const AnimationPhaseSchema = z.object({
  enter: z.number().min(0).max(5),    // Duration in seconds
  hold: z.number().min(0).max(55),    // Duration in seconds (increased for long chats)
  exit: z.number().min(0).max(5),     // Duration in seconds
});

export type AnimationPhase = z.infer<typeof AnimationPhaseSchema>;

/**
 * AI Decision output for a single content block
 */
export const AIDecisionSchema = z.object({
  componentId: z.string(),
  motionProfile: MotionProfileSchema,
  duration: z.number().min(1).max(60), // Increased max for long chat conversations
  animation: AnimationPhaseSchema.optional(),
  props: z.record(z.unknown()).optional(),
});

export type AIDecision = z.infer<typeof AIDecisionSchema>;

/**
 * Complete video plan from AI
 */
export const VideoPlanSchema = z.object({
  decisions: z.array(AIDecisionSchema),
  totalDuration: z.number(),
  suggestedTransitions: z.array(z.enum(['fade', 'slide', 'zoom', 'wipe'])).optional(),
});

export type VideoPlan = z.infer<typeof VideoPlanSchema>;

// ============================================================================
// RENDER LAYER - Component Registry
// ============================================================================

/**
 * Component registry entry
 */
export const ComponentRegistryEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  supportedTypes: z.array(z.string()),
  defaultDuration: z.number(),
  defaultProps: z.record(z.unknown()).optional(),
});

export type ComponentRegistryEntry = z.infer<typeof ComponentRegistryEntrySchema>;

/**
 * Available component IDs
 */
export const COMPONENT_IDS = {
  INTRO: 'intro',
  OUTRO: 'outro',
  STAT: 'stat-scene',
  COMPARISON: 'comparison-scene',
  TEXT: 'text-scene',
  QUOTE: 'quote-scene',
  IMAGE: 'image-scene',
  LIST: 'list-scene',
  TIMELINE: 'timeline-scene',
  CALLOUT: 'callout-scene',
  ICON_LIST: 'icon-list-scene',
  LINE_CHART: 'line-chart-scene',
  PIE_CHART: 'pie-chart-scene',
  CODE: 'code-scene',
  TESTIMONIAL: 'testimonial-scene',
  WHATSAPP_CHAT: 'whatsapp-chat-scene',
  MOTIVATIONAL_IMAGE: 'motivational-image-scene',
  // New components
  COUNTER: 'counter-scene',
  PROGRESS_BAR: 'progress-bar-scene',
  QR_CODE: 'qr-code-scene',
  VIDEO: 'video-scene',
  AVATAR_GRID: 'avatar-grid-scene',
  SOCIAL_STATS: 'social-stats-scene',
  CTA: 'cta-scene',
  GRADIENT_TEXT: 'gradient-text-scene',
  ANIMATED_BG: 'animated-bg-scene',
  COUNTDOWN: 'countdown-scene',
  WEATHER: 'weather-scene',
  TOWER_CHART_3D: 'tower-chart-3d-scene',
  BAR_RACE_3D: 'bar-race-3d-scene',
  PARALLAX_STORY: 'parallax-story-scene',
  PRICING_TABLE: 'pricing-table-scene',
  LOGO_WALL: 'logo-wall-scene',
  PROCESS_STEPS: 'process-steps-scene',
  HTML: 'html-scene',
  DIAGRAM: 'diagram-scene',
  TOP_PLAYERS: 'top-players-scene',
} as const;

export type ComponentId = typeof COMPONENT_IDS[keyof typeof COMPONENT_IDS];

/**
 * Mapping of content types to supported components
 */
export const TYPE_TO_COMPONENT_MAP: Record<string, ComponentId[]> = {
  stat: [COMPONENT_IDS.STAT],
  comparison: [COMPONENT_IDS.COMPARISON],
  text: [COMPONENT_IDS.TEXT],
  image: [COMPONENT_IDS.IMAGE],
  quote: [COMPONENT_IDS.QUOTE],
  list: [COMPONENT_IDS.LIST],
  timeline: [COMPONENT_IDS.TIMELINE],
  callout: [COMPONENT_IDS.CALLOUT],
  'icon-list': [COMPONENT_IDS.ICON_LIST],
  'line-chart': [COMPONENT_IDS.LINE_CHART],
  'pie-chart': [COMPONENT_IDS.PIE_CHART],
  code: [COMPONENT_IDS.CODE],
  testimonial: [COMPONENT_IDS.TESTIMONIAL],
  'whatsapp-chat': [COMPONENT_IDS.WHATSAPP_CHAT],
  'motivational-image': [COMPONENT_IDS.MOTIVATIONAL_IMAGE],
  // New block types
  counter: [COMPONENT_IDS.COUNTER],
  'progress-bar': [COMPONENT_IDS.PROGRESS_BAR],
  'qr-code': [COMPONENT_IDS.QR_CODE],
  video: [COMPONENT_IDS.VIDEO],
  'avatar-grid': [COMPONENT_IDS.AVATAR_GRID],
  'social-stats': [COMPONENT_IDS.SOCIAL_STATS],
  cta: [COMPONENT_IDS.CTA],
  'gradient-text': [COMPONENT_IDS.GRADIENT_TEXT],
  'animated-bg': [COMPONENT_IDS.ANIMATED_BG],
  countdown: [COMPONENT_IDS.COUNTDOWN],
  'weather-block': [COMPONENT_IDS.WEATHER],
  'tower-chart-3d': [COMPONENT_IDS.TOWER_CHART_3D],
  'bar-race-3d': [COMPONENT_IDS.BAR_RACE_3D],
  'parallax-story': [COMPONENT_IDS.PARALLAX_STORY],
  'pricing-table': [COMPONENT_IDS.PRICING_TABLE],
  'logo-wall': [COMPONENT_IDS.LOGO_WALL],
  'process-steps': [COMPONENT_IDS.PROCESS_STEPS],
  html: [COMPONENT_IDS.HTML],
  diagram: [COMPONENT_IDS.DIAGRAM],
  'top-players': [COMPONENT_IDS.TOP_PLAYERS],
};

