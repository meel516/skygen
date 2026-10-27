// ============================================================================
// CONTENT BLOCKS CATALOG API
// GET /api/plugins/content-blocks
//
// Returns a compact, agent-friendly description of all available block types.
// Designed for MCP agents so they know what exists before deciding to
// create a custom plugin.
// ============================================================================

import { NextResponse } from 'next/server';

const CONTENT_BLOCKS = [
  // ── Basic ──────────────────────────────────────────────────────────────────
  {
    type: 'text',
    description: 'Animated text slide with optional emphasis levels.',
    keyFields: ['content (string)', 'emphasis (low|medium|high)'],
    useWhen: 'Simple statements, narration, titles, or any text-only slide.',
  },
  {
    type: 'image',
    description: 'Displays a single image with optional caption.',
    keyFields: ['src (url)', 'alt (string)', 'caption (string)'],
    useWhen: 'Show a photo, illustration, or screenshot.',
  },
  {
    type: 'quote',
    description: 'Stylised pull-quote with author attribution.',
    keyFields: ['text (string, max 300)', 'author (string)'],
    useWhen: 'Highlight an inspiring or impactful quote.',
  },
  {
    type: 'list',
    description: 'Animated bullet, numbered, or checkmark list.',
    keyFields: ['title (string)', 'items (string[])', 'style (bullet|numbered|checkmarks)'],
    useWhen: 'Enumerate steps, features, or key points.',
  },
  // ── Data ───────────────────────────────────────────────────────────────────
  {
    type: 'stat',
    description: 'Large animated KPI / metric highlight.',
    keyFields: ['heading (string)', 'value (string)', 'subtext (string)'],
    useWhen: 'Showcase a single important number or metric.',
  },
  {
    type: 'comparison',
    description: 'Side-by-side bar comparison of 2–6 items.',
    keyFields: ['title (string)', 'items [{label, value, color}]'],
    useWhen: 'Compare multiple categories or options.',
  },
  {
    type: 'line-chart',
    description: 'Animated line chart with labels and axes.',
    keyFields: ['title', 'data (number[])', 'labels (string[])', 'unit'],
    useWhen: 'Show trends, growth, or time-series data.',
  },
  {
    type: 'pie-chart',
    description: 'Animated pie/donut chart with legend.',
    keyFields: ['title', 'segments [{label, value, color}]', 'showPercentage', 'showLegend'],
    useWhen: 'Show distribution or proportions.',
  },
  {
    type: 'timeline',
    description: 'Vertical animated timeline of events.',
    keyFields: ['title', 'events [{year, title, description}]'],
    useWhen: 'Show history, roadmap, or sequence of events.',
  },
  // ── Visual ─────────────────────────────────────────────────────────────────
  {
    type: 'motivational-image',
    description: 'Full-screen image with text overlay, effects, and animations.',
    keyFields: ['imageSrc', 'text', 'textStyle', 'imageEffect', 'overlayType'],
    useWhen: 'Hero slides, cinematic moments, or image-with-caption.',
  },
  {
    type: 'parallax-story',
    description: 'Multi-layer parallax scene with camera movement, effects, and depth.',
    keyFields: ['layers [{image, depth, parallaxFactor}]', 'cameraMovement', 'effects', 'colorGrade'],
    useWhen: 'Cinematic storytelling, product reveals, landscape scenes.',
  },
  {
    type: 'top-players',
    description: 'Countdown-style "Top N" block with CSS 3D depth camera zoom. Shared background with 3-10 player cutouts at different depths; camera dolly-zooms through each player with per-player narration.',
    keyFields: ['backgroundImage', 'players [{rank, name, subtitle, image, audioSrc, text}]', 'revealOrder (top-first|top-last)', 'defaultPerPlayerSeconds'],
    useWhen: 'Top 10 lists, player/person rankings, countdown-style reveals.',
  },
  {
    type: 'video',
    description: 'Embed a video clip with optional text/caption overlay.',
    keyFields: ['src (url)', 'caption', 'overlayType', 'text'],
    useWhen: 'Include a video clip or screen recording.',
  },
  {
    type: 'animated-bg',
    description: 'Full-screen animated background (particles, waves, aurora, etc.).',
    keyFields: ['style (particles|waves|gradient|noise|geometric|aurora)', 'primaryColor', 'secondaryColor', 'speed'],
    useWhen: 'Visual filler, mood-setting, or title card backgrounds.',
  },
  {
    type: 'gradient-text',
    description: 'Large animated gradient text.',
    keyFields: ['text', 'gradient (color[])', 'angle', 'animate', 'fontSize'],
    useWhen: 'Bold title slides or highlight text.',
  },
  // ── Social / Content ────────────────────────────────────────────────────────
  {
    type: 'testimonial',
    description: 'Customer or user testimonial with avatar.',
    keyFields: ['quote', 'author', 'role', 'company', 'avatar (url)'],
    useWhen: 'Show social proof or a customer review.',
  },
  {
    type: 'whatsapp-chat',
    description: 'Animated WhatsApp-style chat conversation.',
    keyFields: ['person1 {name, avatar}', 'person2 {name, avatar}', 'messages [{from, text, time}]'],
    useWhen: 'Show a conversation, dialogue, or messaging flow.',
  },
  {
    type: 'social-stats',
    description: 'Social media follower / engagement stats card.',
    keyFields: ['platform (twitter|instagram|youtube|tiktok|linkedin|facebook)', 'username', 'followers', 'posts', 'likes', 'growthPercentage'],
    useWhen: 'Showcase social media presence or growth.',
  },
  {
    type: 'avatar-grid',
    description: 'Grid or carousel of people / team members.',
    keyFields: ['title', 'avatars [{name, role, image}]', 'layout (grid|carousel|stacked)', 'columns'],
    useWhen: 'Introduce a team, community, or group of users.',
  },
  // ── Interactive / UI ────────────────────────────────────────────────────────
  {
    type: 'callout',
    description: 'Highlighted callout box (success, warning, info, default).',
    keyFields: ['title', 'content', 'variant (success|warning|info|default)'],
    useWhen: 'Draw attention to a key insight, warning, or tip.',
  },
  {
    type: 'icon-list',
    description: 'List of items each with an icon, title, and description.',
    keyFields: ['title', 'items [{icon, title, description}]'],
    useWhen: 'Feature list, benefits, or icon-driven points.',
  },
  {
    type: 'counter',
    description: 'Animates a number counting up (or down).',
    keyFields: ['label', 'from', 'to', 'duration', 'prefix', 'suffix', 'decimals', 'animationStyle'],
    useWhen: 'Animate a statistic, score, or milestone number.',
  },
  {
    type: 'progress-bar',
    description: 'Animated horizontal progress/completion bar.',
    keyFields: ['label', 'value (0-100)', 'color', 'showPercentage', 'animated'],
    useWhen: 'Show completion, skill level, or goal progress.',
  },
  {
    type: 'cta',
    description: 'Call-to-action slide with button and description.',
    keyFields: ['text', 'description', 'buttonStyle', 'color', 'size', 'icon', 'pulse'],
    useWhen: 'End card, sign-up prompt, or action slide.',
  },
  {
    type: 'countdown',
    description: 'Countdown timer (days/hours/minutes/seconds).',
    keyFields: ['title', 'targetDate (ISO)', 'days', 'hours', 'minutes', 'seconds', 'style'],
    useWhen: 'Event countdown, launch timer, or deadline.',
  },
  {
    type: 'qr-code',
    description: 'Animated QR code with optional title and subtitle.',
    keyFields: ['data (url or text)', 'title', 'subtitle', 'size', 'fgColor'],
    useWhen: 'Link to a URL, social profile, or contact info.',
  },
  // ── 3D / Advanced ───────────────────────────────────────────────────────────
  {
    type: 'tower-chart-3d',
    description: '3D animated tower/bar chart with rank reveal and camera pan.',
    keyFields: ['title', 'items [{rank, name, value}]', 'towerStyle (boxes|cylinders|hexagons)', 'backgroundPreset'],
    useWhen: 'Top-N rankings, leaderboards, or dramatic data reveals.',
  },
  {
    type: 'bar-race-3d',
    description: '3D animated bar race chart (values change over time).',
    keyFields: ['title', 'items [{name, value, data (time-series)}]', 'raceDuration'],
    useWhen: 'Show changing rankings or competitive data over time.',
  },
  // ── Data / Docs ─────────────────────────────────────────────────────────────
  {
    type: 'diagram',
    description: 'Animated flowchart, hierarchy, sequence, mindmap, or network diagram.',
    keyFields: ['diagramType (flowchart|hierarchy|sequence|mindmap|network)', 'nodes [{id,label,type}]', 'edges [{from,to,label}]', 'layout'],
    useWhen: 'Explain a process, architecture, or relationship.',
  },
  {
    type: 'code',
    description: 'Syntax-highlighted code block with animated reveal.',
    keyFields: ['code', 'language', 'title'],
    useWhen: 'Show a code snippet, command, or algorithm.',
  },
  {
    type: 'html',
    description: 'Render arbitrary HTML/CSS content.',
    keyFields: ['htmlContent (string, max 50000)', 'title', 'backgroundColor'],
    useWhen: 'Custom layouts, embed charts, or anything not covered by other blocks.',
  },
  // ── Business ────────────────────────────────────────────────────────────────
  {
    type: 'pricing-table',
    description: 'Animated pricing/plan comparison table.',
    keyFields: ['title', 'plans [{name, price, period, features[], highlighted, ctaText}]'],
    useWhen: 'Show product pricing or subscription tiers.',
  },
  {
    type: 'logo-wall',
    description: 'Animated grid of logos/brand images.',
    keyFields: ['title', 'logos [{src, name}]', 'columns'],
    useWhen: 'Show partner logos, integrations, or trusted-by brands.',
  },
  {
    type: 'process-steps',
    description: 'Step-by-step process visualization.',
    keyFields: ['title', 'steps [{number, title, description, icon}]'],
    useWhen: 'How-it-works, onboarding steps, or workflow.',
  },
  {
    type: 'weather-block',
    description: 'Animated weather card with condition, temperature, and forecast.',
    keyFields: ['location', 'temperature', 'unit (F|C)', 'condition', 'humidity', 'windSpeed', 'cardStyle'],
    useWhen: 'Weather report, travel content, or contextual environment.',
  },
  // ── Custom ──────────────────────────────────────────────────────────────────
  {
    type: 'custom-plugin',
    description: 'A custom animation block created via the propose_plugin_preview MCP tool.',
    keyFields: ['pluginId (string — returned by propose_plugin_preview)', 'pluginData (object — matches plugin schema)'],
    useWhen: 'None of the above block types fit the specific visual the user needs.',
  },
];

export async function GET() {
  return NextResponse.json({
    total: CONTENT_BLOCKS.length,
    blocks: CONTENT_BLOCKS,
    note: 'All blocks also accept: verticalAlign, horizontalAlign, enterAnimation, exitAnimation, backgroundColor, audioSrc (TTS narration). Use "custom-plugin" + propose_plugin_preview when no existing block fits.',
  });
}
