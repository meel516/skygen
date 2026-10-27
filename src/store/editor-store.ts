import { create } from 'zustand';
import { ContentBlock, VideoMeta, VideoInput, AudioTrack, BlockCustomization, CustomPluginBlock } from '@/lib/video/schemas';
import { VideoTemplate, PUBLIC_TEMPLATES, resolveTemplateVariables } from '@/lib/video/templates/template-definitions';
import { AdvancedVideoTemplate, ADVANCED_TEMPLATES, convertTemplateToBlocks, getAdvancedTemplateById } from '@/lib/video/templates/advanced-templates';

// User template storage key
const USER_TEMPLATES_KEY = 'videogen-user-templates';

export interface UserTemplate {
  id: string;
  name: string;
  createdAt: string;
  videoMeta: VideoMeta;
  blocks: ContentBlock[];
  description?: string;
  category?: string;
  requiredVariables?: { key: string; label: string; defaultValue?: string }[];
  previewUrl?: string;
  isPublic?: boolean;
  isFreeTier?: boolean;
}

function mapDbTemplateToUserTemplate(template: any): UserTemplate {
  return {
    id: template.id,
    name: template.name,
    description: template.description || '',
    category: template.category || 'general',
    createdAt: template.createdAt,
    videoMeta: template.data?.videoMeta || {},
    blocks: template.data?.blocks || [],
    requiredVariables: template.data?.requiredVariables || [],
    previewUrl: template.previewUrl || '',
    isPublic: Boolean(template.isPublic),
    isFreeTier: Boolean(template.isFreeTier),
  };
}

// Default customization values for all blocks
// Only set values that should override the BaseScene defaults
const DEFAULT_CUSTOMIZATION: Partial<BlockCustomization> = {
  enterAnimation: 'fade',
  exitAnimation: 'fade',
  animationDuration: 0.5,
  backgroundBlur: 0,
  borderWidth: 0,
  borderRadius: 0,
  shadowEnabled: false,
  shadowColor: 'rgba(0,0,0,0.5)',
  shadowBlur: 20,
  // Don't set padding - let BaseScene use its default of 60
  // padding: 20,  // Removed - this was causing blocks to appear at top
  margin: 0,
};

// Block templates for adding new blocks
export const BLOCK_TEMPLATES: Record<string, Partial<ContentBlock>> = {
  stat: {
    type: 'stat',
    heading: 'New Stat',
    value: '100%',
    subtext: 'Description here',
  } as ContentBlock,
  comparison: {
    type: 'comparison',
    title: 'Comparison',
    items: [
      { label: 'Item A', value: 50, color: '#3B82F6' },
      { label: 'Item B', value: 30, color: '#10B981' },
    ],
  } as ContentBlock,
  text: {
    type: 'text',
    content: 'Enter your text here',
    emphasis: 'medium',
  } as ContentBlock,
  image: {
    type: 'image',
    src: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800',
    alt: 'Image',
    caption: '',
  } as ContentBlock,
  quote: {
    type: 'quote',
    text: 'Enter your quote here',
    author: 'Author Name',
  } as ContentBlock,
  list: {
    type: 'list',
    title: 'List Title',
    items: ['Item 1', 'Item 2', 'Item 3'],
    style: 'bullet',
  } as ContentBlock,
  timeline: {
    type: 'timeline',
    title: 'Timeline',
    events: [
      { year: '2020', title: 'Event 1', description: '' },
      { year: '2022', title: 'Event 2', description: '' },
    ],
  } as ContentBlock,
  callout: {
    type: 'callout',
    title: 'Callout',
    content: 'Important information',
    variant: 'default',
  } as ContentBlock,
  'icon-list': {
    type: 'icon-list',
    title: 'Features',
    items: [
      { icon: '🚀', title: 'Feature 1', description: '' },
      { icon: '⭐', title: 'Feature 2', description: '' },
    ],
  } as ContentBlock,
  'line-chart': {
    type: 'line-chart',
    title: 'Chart',
    data: [10, 25, 40, 60, 80],
    labels: ['A', 'B', 'C', 'D', 'E'],
    lineColor: '#3B82F6',
  } as ContentBlock,
  'pie-chart': {
    type: 'pie-chart',
    title: 'Pie Chart',
    segments: [
      { label: 'Segment A', value: 40, color: '#3B82F6' },
      { label: 'Segment B', value: 35, color: '#10B981' },
      { label: 'Segment C', value: 25, color: '#F59E0B' },
    ],
  } as ContentBlock,
  code: {
    type: 'code',
    code: '// Your code here\nconsole.log("Hello World");',
    language: 'javascript',
    title: 'Code Example',
  } as ContentBlock,
  testimonial: {
    type: 'testimonial',
    quote: 'Customer testimonial here',
    author: 'Customer Name',
    role: 'Role',
    company: 'Company',
  } as ContentBlock,
  'whatsapp-chat': {
    type: 'whatsapp-chat',
    person1: { name: 'You', isOnline: true },
    person2: { name: 'Contact', isOnline: true },
    messages: [
      { from: 'person2', text: 'Hello!' },
      { from: 'person1', text: 'Hi there!' },
    ],
    showTypingIndicator: true,
  } as ContentBlock,
  'motivational-image': {
    type: 'motivational-image',
    imageSrc: 'https://images.unsplash.com/photo-1504805572947-34fad45aed93?w=800',
    imageEffect: 'ken-burns',
    text: 'Your motivational text',
    textStyle: 'default',
    fontSize: 'xlarge',
    fontWeight: 'bold',
    textColor: '#FFFFFF',
    textAlign: 'center',
    textPosition: 'center',
    colorOverlay: { enabled: true, color: '#000000', opacity: 0.4 },
    duration: 6,
  } as ContentBlock,
  // New block templates
  counter: {
    type: 'counter',
    label: 'Downloads',
    from: 0,
    to: 10000,
    duration: 3,
    suffix: '+',
    color: '#3B82F6',
    animationStyle: 'easeOut',
  } as ContentBlock,
  'progress-bar': {
    type: 'progress-bar',
    label: 'Progress',
    value: 75,
    color: '#10B981',
    backgroundColor: '#1F2937',
    height: 'medium',
    showPercentage: true,
    animated: true,
    stripes: false,
  } as ContentBlock,
  'qr-code': {
    type: 'qr-code',
    data: 'https://example.com',
    title: 'Scan Me',
    subtitle: 'Visit our website',
    size: 'medium',
    fgColor: '#000000',
    bgColor: '#FFFFFF',
  } as ContentBlock,
  video: {
    type: 'video',
    src: 'https://www.w3schools.com/html/mov_bbb.mp4',
    autoPlay: true,
    loop: false,
    muted: true,
    controls: false,
  } as ContentBlock,
  'avatar-grid': {
    type: 'avatar-grid',
    title: 'Our Team',
    subtitle: 'Meet the amazing people behind our success',
    avatars: [
      { name: 'John Doe', role: 'CEO', image: '' },
      { name: 'Jane Smith', role: 'CTO', image: '' },
      { name: 'Bob Wilson', role: 'Designer', image: '' },
    ],
    layout: 'grid',
    columns: 3,
  } as ContentBlock,
  'social-stats': {
    type: 'social-stats',
    platform: 'twitter',
    username: '@username',
    followers: 50000,
    posts: 1250,
    verified: true,
    showGrowth: true,
    growthPercentage: 15.5,
  } as ContentBlock,
  cta: {
    type: 'cta',
    text: 'Get Started Now',
    description: 'Join thousands of satisfied users',
    buttonStyle: 'primary',
    color: '#3B82F6',
    size: 'large',
    pulse: true,
  } as ContentBlock,
  'gradient-text': {
    type: 'gradient-text',
    text: 'Make It Happen',
    gradient: ['#3B82F6', '#8B5CF6', '#EC4899'],
    angle: 45,
    animate: true,
    animationSpeed: 3,
    fontSize: 'xxlarge',
    fontWeight: 'bold',
  } as ContentBlock,
  'animated-bg': {
    type: 'animated-bg',
    style: 'particles',
    primaryColor: '#3B82F6',
    secondaryColor: '#8B5CF6',
    speed: 1,
    intensity: 0.5,
    overlay: false,
  } as ContentBlock,
  countdown: {
    type: 'countdown',
    title: 'Limited Time Offer',
    days: 3,
    hours: 12,
    minutes: 30,
    seconds: 0,
    style: 'modern',
    color: '#FFFFFF',
    showLabels: true,
  } as ContentBlock,
  'weather-block': {
    type: 'weather-block',
    location: 'San Francisco',
    temperature: 72,
    unit: 'F',
    condition: 'partly-cloudy',
    description: 'Partly Cloudy',
    humidity: 65,
    windSpeed: 12,
    highTemp: 78,
    lowTemp: 58,
    showForecast: true,
    showDetails: true,
    cardStyle: 'glass',
    accentColor: '#38BDF8',
    animateIcon: true,
  } as ContentBlock,
  'tower-chart-3d': {
    type: 'tower-chart-3d',
    title: 'Top Video Games by Sales',
    subtitle: 'All Time Best Sellers',
    items: [
      { rank: 1, name: 'Minecraft', value: 300000000, valueFormatted: '300M', subtitle: '2011', color: '#62B47A', image: 'https://upload.wikimedia.org/wikipedia/en/5/51/Minecraft_cover.png' },
      { rank: 2, name: 'GTA V', value: 200000000, valueFormatted: '200M', subtitle: '2013', color: '#9B87C0', image: 'https://upload.wikimedia.org/wikipedia/en/1/15/Grand_Theft_Auto_V.png' },
      { rank: 3, name: 'Tetris', value: 170000000, valueFormatted: '170M', subtitle: '1984', color: '#4FA4E7', image: 'https://upload.wikimedia.org/wikipedia/en/4/4f/Tetris_NES_cover_art.jpg' },
      { rank: 4, name: 'Wii Sports', value: 83000000, valueFormatted: '83M', subtitle: '2006', color: '#00ADD8', image: 'https://upload.wikimedia.org/wikipedia/en/8/83/Wii_Sports_European_box_art.jpg' },
      { rank: 5, name: 'PUBG', value: 75000000, valueFormatted: '75M', subtitle: '2017', color: '#F4A460', image: 'https://upload.wikimedia.org/wikipedia/en/9/9f/Pubg_Game-Cover.jpg' },
      { rank: 6, name: 'Mario Kart 8', value: 60000000, valueFormatted: '60M', subtitle: '2014', color: '#E63946', image: 'https://upload.wikimedia.org/wikipedia/en/1/1d/Mario_Kart_8_box_art.png' },
      { rank: 7, name: 'Red Dead 2', value: 55000000, valueFormatted: '55M', subtitle: '2018', color: '#C49B66', image: 'https://upload.wikimedia.org/wikipedia/en/4/44/Red_Dead_Redemption_II.jpg' },
      { rank: 8, name: 'Skyrim', value: 48000000, valueFormatted: '48M', subtitle: '2011', color: '#7B68EE', image: 'https://upload.wikimedia.org/wikipedia/en/1/1b/The_Elder_Scrolls_V_Skyrim_cover.png' },
      { rank: 9, name: 'Super Mario', value: 45000000, valueFormatted: '45M', subtitle: '2017', color: '#E52521', image: 'https://upload.wikimedia.org/wikipedia/en/8/8f/Super_Mario_Odyssey_logo.jpg' },
      { rank: 10, name: 'Animal Crossing', value: 42000000, valueFormatted: '42M', subtitle: '2020', color: '#77DD77', image: 'https://upload.wikimedia.org/wikipedia/en/8/83/Animal_Crossing_New_Horizons.jpg' },
    ],
    towerStyle: 'boxes',
    towerSpacing: 6,
    baseHeight: 3,
    maxHeight: 28,
    gradientStart: '#3B82F6',
    gradientEnd: '#8B5CF6',
    useGradientByRank: true,
    showValueLabels: true,
    showRankNumbers: true,
    cameraDistance: 30,
    cameraPauseDuration: 0.5,
    cameraMoveSpeed: 0.6,
    cameraAngle: 30,
    backgroundColor: '#050510',
    groundColor: '#0a0a20',
    showGround: true,
    ambientIntensity: 0.6,
    showLabels3D: true,
    introAnimation: 'fade',
    itemRevealDelay: 0.05,
  } as ContentBlock,
  'bar-race-3d': {
    type: 'bar-race-3d',
    title: 'Market Share Battle',
    subtitle: 'Tech Giants Revenue Race',
    items: [
      { rank: 1, name: 'Apple', value: 383, valueFormatted: '$383B', subtitle: '2024', color: '#A2AAAD' },
      { rank: 2, name: 'Microsoft', value: 245, valueFormatted: '$245B', subtitle: '2024', color: '#00A4EF' },
      { rank: 3, name: 'Google', value: 307, valueFormatted: '$307B', subtitle: '2024', color: '#4285F4' },
      { rank: 4, name: 'Amazon', value: 575, valueFormatted: '$575B', subtitle: '2024', color: '#FF9900' },
      { rank: 5, name: 'Meta', value: 135, valueFormatted: '$135B', subtitle: '2024', color: '#0668E1' },
      { rank: 6, name: 'Tesla', value: 97, valueFormatted: '$97B', subtitle: '2024', color: '#CC0000' },
      { rank: 7, name: 'Nvidia', value: 61, valueFormatted: '$61B', subtitle: '2024', color: '#76B900' },
      { rank: 8, name: 'Netflix', value: 34, valueFormatted: '$34B', subtitle: '2024', color: '#E50914' },
    ],
    barStyle: 'rounded',
    barSpacing: 3.5,
    barHeight: 2.5,
    barDepth: 2,
    maxBarWidth: 30,
    animationSpeed: 1,
    rankChangeSpeed: 0.8,
    showValueLabels: true,
    showRankNumbers: true,
    cameraDistance: 35,
    cameraAngle: 30,
    backgroundColor: '#0a0a1a',
    groundColor: '#151525',
    showGround: true,
    ambientIntensity: 0.6,
    showLabels3D: true,
    introAnimation: 'slide',
    itemRevealDelay: 0.08,
  } as ContentBlock,
  'parallax-story': {
    type: 'parallax-story',
    title: 'A Journey Through Time',
    subtitle: 'A Cinematic Story',
    layers: [
      {
        id: 'sky',
        name: 'Sky Background',
        image: 'https://images.unsplash.com/photo-1534088568595-a066f410bcda?w=1920&q=80',
        depth: 100,
        parallaxFactor: 0.2,
        scale: 1.2,
        opacity: 1,
        positionX: 0,
        positionY: 0,
        rotation: 0,
        blur: 0,
        blendMode: 'normal',
        motionEnabled: true,
        motionDirection: 'right',
        motionSpeed: 0.3,
        motionIntensity: 0.5,
        motionOscillate: false,
        animationIn: 'fade',
        animationOut: 'fade',
        animationDelay: 0,
        animationDuration: 1.5,
        animationEasing: 'ease-out',
      },
      {
        id: 'mountains',
        name: 'Mountains',
        image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1920&q=80',
        depth: 70,
        parallaxFactor: 0.5,
        scale: 1.3,
        opacity: 0.9,
        positionX: 0,
        positionY: 10,
        rotation: 0,
        blur: 0,
        blendMode: 'normal',
        motionEnabled: true,
        motionDirection: 'right',
        motionSpeed: 0.5,
        motionIntensity: 0.8,
        motionOscillate: false,
        animationIn: 'fade',
        animationOut: 'fade',
        animationDelay: 0.2,
        animationDuration: 1.2,
        animationEasing: 'ease-out',
      },
      {
        id: 'trees',
        name: 'Forest Trees',
        image: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=1920&q=80',
        depth: 30,
        parallaxFactor: 1.5,
        scale: 1.5,
        opacity: 0.85,
        positionX: 0,
        positionY: 5,
        rotation: 0,
        blur: 0,
        blendMode: 'normal',
        motionEnabled: true,
        motionDirection: 'right',
        motionSpeed: 1,
        motionIntensity: 1.2,
        motionOscillate: false,
        animationIn: 'zoom-in',
        animationOut: 'fade',
        animationDelay: 0.4,
        animationDuration: 1,
        animationEasing: 'ease-out',
      },
      {
        id: 'foreground',
        name: 'Foreground Subject',
        image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80',
        depth: 5,
        parallaxFactor: 3,
        scale: 1,
        opacity: 1,
        positionX: 0,
        positionY: 0,
        rotation: 0,
        blur: 0,
        blendMode: 'normal',
        motionEnabled: true,
        motionDirection: 'float',
        motionSpeed: 1.5,
        motionIntensity: 0.5,
        motionOscillate: true,
        motionOscillateSpeed: 1,
        animationIn: 'slide-left',
        animationOut: 'fade',
        animationDelay: 0.6,
        animationDuration: 0.8,
        animationEasing: 'bounce',
      },
    ],
    cameraMovement: 'pan-right',
    cameraSpeed: 1,
    cameraIntensity: 1,
    effects: ['vignette', 'particles'],
    effectIntensity: 0.5,
    textOverlays: [
      {
        text: 'Once upon a time...',
        position: 'center',
        fontSize: 'xlarge',
        fontWeight: 'bold',
        color: '#FFFFFF',
        shadow: true,
        shadowColor: 'rgba(0,0,0,0.8)',
        textAlign: 'center',
        animation: 'fade',
        animationDelay: 1,
        duration: 3,
        startTime: 0,
      },
      {
        text: 'There was a story waiting to be told.',
        position: 'bottom',
        fontSize: 'large',
        fontWeight: 'normal',
        color: '#FFFFFF',
        shadow: true,
        shadowColor: 'rgba(0,0,0,0.8)',
        textAlign: 'center',
        animation: 'slide-up',
        animationDelay: 0.5,
        duration: 3,
        startTime: 3,
      },
    ],
    colorGrade: 'cinematic',
    colorIntensity: 0.4,
    backgroundColor: '#000000',
    fitMode: 'cover',
    introDuration: 1,
    outroDuration: 1,
    loopAnimation: false,
    dofEnabled: false,
    dofFocusDepth: 50,
    dofBlurAmount: 2,
    perspective: 1000,
    perspectiveOriginX: 50,
    perspectiveOriginY: 50,
  } as ContentBlock,
  'top-players': {
    type: 'top-players',
    title: 'Top 5 Players',
    subtitle: 'Greatest of All Time',
    backgroundImage: '',
    revealOrder: 'top-last',
    defaultPerPlayerSeconds: 3,
    players: [
      { rank: 1, name: 'Player One', subtitle: 'Team A', image: '', text: 'At number one, Player One.', audioSrc: '' },
      { rank: 2, name: 'Player Two', subtitle: 'Team B', image: '', text: 'At number two, Player Two.', audioSrc: '' },
      { rank: 3, name: 'Player Three', subtitle: 'Team C', image: '', text: 'At number three, Player Three.', audioSrc: '' },
    ],
  } as ContentBlock,
  'pricing-table': {
    type: 'pricing-table',
    title: 'Choose Your Plan',
    subtitle: 'Simple, transparent pricing',
    plans: [
      { name: 'Starter', price: '$9', period: '/mo', features: ['5 Projects', '10GB Storage', 'Email Support'], highlighted: false, ctaText: 'Get Started' },
      { name: 'Pro', price: '$29', period: '/mo', features: ['Unlimited Projects', '100GB Storage', 'Priority Support', 'Analytics'], highlighted: true, ctaText: 'Go Pro' },
      { name: 'Enterprise', price: '$99', period: '/mo', features: ['Everything in Pro', 'Custom Integrations', 'Dedicated Manager', 'SLA'], highlighted: false, ctaText: 'Contact Us' },
    ],
  } as ContentBlock,
  'logo-wall': {
    type: 'logo-wall',
    title: 'Trusted By',
    subtitle: 'Leading companies worldwide',
    columns: 4,
    logos: [
      { name: 'Acme Corp', src: '' },
      { name: 'Globex', src: '' },
      { name: 'Initech', src: '' },
      { name: 'Umbrella', src: '' },
    ],
  } as ContentBlock,
  'process-steps': {
    type: 'process-steps',
    title: 'How It Works',
    subtitle: 'Get started in 3 simple steps',
    steps: [
      { number: 1, title: 'Sign Up', description: 'Create your free account', icon: '📝' },
      { number: 2, title: 'Configure', description: 'Set up your preferences', icon: '⚙️' },
      { number: 3, title: 'Launch', description: 'Go live in minutes', icon: '🚀' },
    ],
  } as ContentBlock,
  html: {
    type: 'html',
    htmlContent: `<!DOCTYPE html>
<html>
<head>
<style>
  body {
    margin: 0; padding: 0; width: 100%; height: 100%;
    display: flex; align-items: center; justify-content: center;
    background: linear-gradient(135deg, #0f0c29, #302b63, #24243e);
    font-family: 'Segoe UI', sans-serif; color: white;
  }
  .card {
    background: rgba(255,255,255,0.1); border-radius: 16px;
    padding: 40px; text-align: center; backdrop-filter: blur(10px);
    border: 1px solid rgba(255,255,255,0.2);
  }
  h1 { font-size: 2.5em; margin: 0 0 10px; }
  p { font-size: 1.1em; opacity: 0.8; }
</style>
</head>
<body>
  <div class="card">
    <h1>Hello World</h1>
    <p>Edit this HTML/CSS/JS block</p>
  </div>
</body>
</html>`,
    title: 'Custom HTML',
  } as ContentBlock,
  diagram: {
    type: 'diagram',
    diagramType: 'flowchart',
    title: 'Process Flow',
    nodes: [
      { id: 'start', label: 'Start', type: 'start', color: '#10B981' },
      { id: 'step1', label: 'Step 1', type: 'process', color: '#3B82F6' },
      { id: 'step2', label: 'Step 2', type: 'process', color: '#8B5CF6' },
      { id: 'end', label: 'Done', type: 'end', color: '#F59E0B' },
    ],
    edges: [
      { from: 'start', to: 'step1' },
      { from: 'step1', to: 'step2' },
      { from: 'step2', to: 'end' },
    ],
    layout: 'vertical',
    templateId: 'simple-flow',
    primaryColor: '#3B82F6',
  } as ContentBlock,
};

// History for undo/redo
interface HistoryState {
  past: VideoInput[];
  present: VideoInput;
  future: VideoInput[];
}

interface EditorStore {
  // Current video state
  videoInput: VideoInput;

  // UI state
  selectedBlockIndex: number | null;
  isPlaying: boolean;
  currentTime: number;
  isDirty: boolean;

  // Export job status
  exportJobStatus: 'idle' | 'queued' | 'processing' | 'completed' | 'failed';
  exportJobId: string | null;
  exportProgress: number;        // 0–100
  exportOutputUrl: string | null; // S3 URL once render is done

  // History for undo/redo
  history: HistoryState;
  
  // Actions
  setVideoInput: (input: VideoInput) => void;
  updateVideoMeta: (meta: Partial<VideoMeta>) => void;
  addBlock: (type: string) => void;
  addPluginBlock: (pluginId: string, defaults: Record<string, unknown>) => void;
  updateBlock: (index: number, block: Partial<ContentBlock>) => void;
  removeBlock: (index: number) => void;
  duplicateBlock: (index: number) => void;
  moveBlock: (fromIndex: number, toIndex: number) => void;
  selectBlock: (index: number | null) => void;
  
  // Audio Track actions
  addAudioTrack: (track: Omit<AudioTrack, 'id'>) => void;
  updateAudioTrack: (trackId: string, track: Partial<AudioTrack>) => void;
  removeAudioTrack: (trackId: string) => void;
  moveAudioTrack: (fromIndex: number, toIndex: number) => void;
  
  // Playback
  setIsPlaying: (playing: boolean) => void;
  setCurrentTime: (time: number) => void;
  setIsDirty: (dirty: boolean) => void;

  // Export job status
  setExportJobStatus: (status: 'idle' | 'queued' | 'processing' | 'completed' | 'failed', jobId?: string | null) => void;

  // Undo/Redo
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // Export
  getVideoJson: () => string;
  exportVideo: () => Promise<null>;
  downloadExport: () => void;

  // Template state
  currentTemplate: VideoTemplate | null;
  templateVariables: Record<string, string>;
  userTemplates: UserTemplate[];
  publicTemplates: UserTemplate[];
  editingTemplateId: string | null;
  setEditingTemplateId: (id: string | null) => void;

  // Template actions
  getPublicTemplates: () => VideoTemplate[];
  getTemplateById: (id: string) => VideoTemplate | undefined;
  applyTemplate: (template: VideoTemplate, variables?: Record<string, string>) => void;
  setTemplateVariables: (variables: Record<string, string>) => void;
  saveAsTemplate: (name: string, previewImage?: string, description?: string) => Promise<void>;
  loadUserTemplate: (id: string, variables?: Record<string, string>) => void;
  deleteUserTemplate: (id: string) => Promise<void>;
  loadUserTemplates: () => void;
  loadDbTemplates: () => Promise<void>;
  loadPublicTemplates: () => Promise<void>;
  savePublicTemplate: (template: Omit<UserTemplate, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  saveTemplateToDb: (template: Omit<UserTemplate, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  deleteDbTemplate: (id: string) => Promise<void>;
  makeTemplatePublic: (id: string) => Promise<void>;

  // Advanced templates
  getAdvancedTemplates: () => AdvancedVideoTemplate[];
  getAdvancedTemplateById: (id: string) => AdvancedVideoTemplate | undefined;
  applyAdvancedTemplate: (template: AdvancedVideoTemplate, variables: Record<string, string>) => void;
}

const defaultVideoMeta: VideoMeta = {
  aspectRatio: '9:16',
  theme: 'dark_modern',
  fps: 30,
  audioTracks: [],
};

const defaultVideoInput: VideoInput = {
  videoMeta: defaultVideoMeta,
  contentBlocks: [],
};

// Helper to create history snapshot
const createSnapshot = (videoInput: VideoInput): VideoInput => {
  return JSON.parse(JSON.stringify(videoInput));
};

export const useEditorStore = create<EditorStore>((set, get) => ({
  // Initial state
  videoInput: defaultVideoInput,
  selectedBlockIndex: null,
  isPlaying: false,
  currentTime: 0,
  isDirty: false,
  exportJobStatus: 'idle',
  exportJobId: null,
  exportProgress: 0,
  exportOutputUrl: null,
  history: {
    past: [],
    present: defaultVideoInput,
    future: [],
  },

  // Template state
  currentTemplate: null,
  templateVariables: {},
  userTemplates: [],
  publicTemplates: [],
  editingTemplateId: null,
  setEditingTemplateId: (id) => set({ editingTemplateId: id }),

  // Template actions
  getPublicTemplates: () => PUBLIC_TEMPLATES,

  getTemplateById: (id: string) => {
    return PUBLIC_TEMPLATES.find(t => t.id === id);
  },

  applyTemplate: (template, variables = {}) => {
    // Resolve template variables in blocks
    const resolvedBlocks = resolveTemplateVariables(template.blocks, variables);

    const newInput: VideoInput = {
      videoMeta: template.videoMeta,
      contentBlocks: resolvedBlocks.map(block => ({
        ...DEFAULT_CUSTOMIZATION,
        ...block,
      })) as ContentBlock[],
    };

    const currentPresent = get().history.present;
    set({
      currentTemplate: template,
      templateVariables: variables,
      videoInput: newInput,
      selectedBlockIndex: null,
      history: {
        past: [...get().history.past, currentPresent].slice(-50),
        present: createSnapshot(newInput),
        future: [],
      },
    });
  },

  setTemplateVariables: (variables) => {
    const template = get().currentTemplate;
    if (!template) return;

    // Re-apply template with new variables
    const resolvedBlocks = resolveTemplateVariables(template.blocks, variables);
    const newInput: VideoInput = {
      videoMeta: template.videoMeta,
      contentBlocks: resolvedBlocks as ContentBlock[],
    };

    const currentPresent = get().history.present;
    set({
      templateVariables: variables,
      videoInput: newInput,
      history: {
        past: [...get().history.past, currentPresent].slice(-50),
        present: createSnapshot(newInput),
        future: [],
      },
    });
  },

  saveAsTemplate: async (name, previewImage, description) => {
    const { videoInput, editingTemplateId } = get();
    const data = {
      videoMeta: videoInput.videoMeta,
      blocks: videoInput.contentBlocks,
    };

    try {
      if (editingTemplateId) {
        // Update existing template
        const res = await fetch(`/api/templates/${editingTemplateId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, description: description || '', data, previewUrl: previewImage }),
        });
        if (!res.ok) {
          const error = await res.json().catch(() => ({}));
          throw new Error(error.error || 'Failed to update template');
        }
        const updated = await res.json();
        set({
          userTemplates: get().userTemplates.map(t =>
            t.id === editingTemplateId ? mapDbTemplateToUserTemplate(updated) : t
          ),
          editingTemplateId: null,
        });
      } else {
        // Create new template
        const res = await fetch('/api/templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            description: description || '',
            category: 'user',
            type: 'user',
            data,
            isPublic: false,
            previewUrl: previewImage || '',
          }),
        });
        if (!res.ok) {
          const error = await res.json().catch(() => ({}));
          throw new Error(error.error || 'Failed to save template');
        }
        const saved = await res.json();
        set({ userTemplates: [...get().userTemplates, mapDbTemplateToUserTemplate(saved)] });
      }
    } catch (e) {
      console.error('Failed to save template to DB:', e);
      throw e;
    }
  },

  loadUserTemplate: (id, variables?: Record<string, string>) => {
    const template = get().userTemplates.find(t => t.id === id);
    if (!template) return;

    let updatedBlocks: ContentBlock[];

    // Check if we have AI-generated content with NEW scenes
    const hasGeneratedContent = variables && Object.keys(variables).length > 0;
    const hasNewScenes = hasGeneratedContent && Object.keys(variables).some(k => k.startsWith('block_'));

    if (hasNewScenes) {
      // Create NEW blocks from AI-generated content
      // Group variables by scene index
      const scenes: Record<number, Record<string, string>> = {};

      Object.entries(variables).forEach(([key, value]) => {
        if (!value || !key.startsWith('block_')) return;
        const match = key.match(/^block_(\d+)_(\w+)$/);
        if (match) {
          const sceneIdx = parseInt(match[1]);
          const field = match[2];
          if (!scenes[sceneIdx]) scenes[sceneIdx] = {};
          scenes[sceneIdx][field] = value;
        }
      });

      // Create new blocks for each scene
      // Use the block type passed from AI (block_${index}_type)
      updatedBlocks = Object.entries(scenes).sort(([a], [b]) => parseInt(a) - parseInt(b)).map(([_, sceneData]) => {
        // Use the block type that AI generated - this is now passed as block_${index}_type
        const blockType = (sceneData.type || 'text') as ContentBlock['type'];

        // Remove 'type' from sceneData before using the rest
        const { type: _type, ...rest } = sceneData;

        // Parse JSON strings back to objects/arrays (e.g., items, events)
        const parsedRest: Record<string, any> = {};
        Object.entries(rest).forEach(([key, value]) => {
          if (typeof value === 'string' && (value.startsWith('[') || value.startsWith('{'))) {
            try {
              parsedRest[key] = JSON.parse(value);
            } catch {
              parsedRest[key] = value;
            }
          } else {
            parsedRest[key] = value;
          }
        });

        return {
          type: blockType,
          ...parsedRest,
        } as ContentBlock;
      });
    } else {
      // Original behavior - apply variables to existing blocks
      updatedBlocks = [...template.blocks] as ContentBlock[];
      if (hasGeneratedContent) {
        updatedBlocks = template.blocks.map((block, blockIndex) => {
          const updatedBlock = { ...block };
          Object.entries(variables).forEach(([key, value]) => {
            if (!value) return;
            const matchResult = key.match(/^block_(\d+)_(\w+)$/);
            if (matchResult) {
              const blockIdx = parseInt(matchResult[1]);
              const field = matchResult[2];
              if (blockIdx === blockIndex) {
                // Parse JSON strings back to objects/arrays (e.g., items, events)
                let parsedValue = value;
                if (typeof value === 'string' && (value.startsWith('[') || value.startsWith('{'))) {
                  try {
                    parsedValue = JSON.parse(value);
                  } catch {
                    // Keep as string if not valid JSON
                  }
                }
                // Generic: set field directly, with mappings for common aliases
                const fieldMappings: Record<string, string> = {
                  'image': 'backgroundImage',
                  'audio': 'audioSrc',
                };
                const targetField = fieldMappings[field] || field;
                (updatedBlock as any)[targetField] = parsedValue;
              }
            }
          });
          return updatedBlock;
        }) as ContentBlock[];
      }
    }

    const newInput: VideoInput = {
      videoMeta: template.videoMeta,
      contentBlocks: updatedBlocks,
    };

    const currentPresent = get().history.present;
    set({
      currentTemplate: null,
      templateVariables: variables || {},
      videoInput: newInput,
      selectedBlockIndex: null,
      history: {
        past: [...get().history.past, currentPresent].slice(-50),
        present: createSnapshot(newInput),
        future: [],
      },
    });
  },

  deleteUserTemplate: async (id) => {
    // Try to delete from database
    try {
      const res = await fetch(`/api/templates/${id}`, { method: 'DELETE' });
      if (res.ok) {
        set({ userTemplates: get().userTemplates.filter(t => t.id !== id) });
        return;
      }
    } catch (e) {
      console.error('Failed to delete template from DB:', e);
    }

    // Fallback to local
    const updated = get().userTemplates.filter(t => t.id !== id);
    set({ userTemplates: updated });
    localStorage.setItem(USER_TEMPLATES_KEY, JSON.stringify(updated));
  },

  loadUserTemplates: () => {
    // Deprecated - now loads from database
    // Keeping for backward compatibility
    try {
      const stored = localStorage.getItem(USER_TEMPLATES_KEY);
      if (stored) {
        set({ userTemplates: JSON.parse(stored) });
      }
    } catch (e) {
      console.error('Failed to load user templates:', e);
    }
  },

  loadDbTemplates: async () => {
    try {
      const res = await fetch('/api/templates');
      if (res.ok) {
        const templates = await res.json();
        const transformed = templates.map(mapDbTemplateToUserTemplate);
        set({ userTemplates: transformed });
      }
    } catch (e) {
      console.error('Failed to load templates from DB:', e);
    }
  },

  saveTemplateToDb: async (template) => {
    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(template),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to save template');
      }

      const saved = await res.json();
      set({ userTemplates: [...get().userTemplates, mapDbTemplateToUserTemplate(saved)] });
    } catch (e) {
      console.error('Failed to save template to DB:', e);
      throw e;
    }
  },

  loadPublicTemplates: async () => {
    try {
      const res = await fetch('/api/admin/public-templates');
      if (res.ok) {
        const templates = await res.json();
        const transformed = templates.map(mapDbTemplateToUserTemplate);
        set({ publicTemplates: transformed });
      }
    } catch (e) {
      console.error('Failed to load public templates from DB:', e);
    }
  },

  savePublicTemplate: async (template) => {
    try {
      const res = await fetch('/api/admin/public-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(template),
      });
      if (res.ok) {
        const saved = await res.json();
        set({ publicTemplates: [...get().publicTemplates, saved] });
      }
    } catch (e) {
      console.error('Failed to save public template to DB:', e);
    }
  },

  deleteDbTemplate: async (id: string) => {
    try {
      const res = await fetch(`/api/templates/${id}`, { method: 'DELETE' });
      if (res.ok) {
        set({ userTemplates: get().userTemplates.filter(t => t.id !== id) });
      }
    } catch (e) {
      console.error('Failed to delete template from DB:', e);
    }
  },

  makeTemplatePublic: async (id: string) => {
    try {
      const res = await fetch(`/api/templates/${id}/public`, { method: 'POST' });
      if (res.ok) {
        const template = get().userTemplates.find(t => t.id === id);
        if (template) {
          set({
            publicTemplates: [...get().publicTemplates, template],
            userTemplates: get().userTemplates.filter(t => t.id !== id)
          });
        }
      }
    } catch (e) {
      console.error('Failed to make template public:', e);
    }
  },

  // Advanced template actions
  getAdvancedTemplates: () => ADVANCED_TEMPLATES,

  getAdvancedTemplateById: (id: string) => {
    return getAdvancedTemplateById(id);
  },

  applyAdvancedTemplate: (template, variables = {}) => {
    // Convert advanced template to parallax-story blocks
    const blocks = convertTemplateToBlocks(template, variables);

    const newInput: VideoInput = {
      videoMeta: template.videoMeta,
      contentBlocks: blocks.map(block => ({
        ...DEFAULT_CUSTOMIZATION,
        ...block,
      })) as ContentBlock[],
    };

    const currentPresent = get().history.present;
    set({
      currentTemplate: null,
      templateVariables: variables,
      videoInput: newInput,
      selectedBlockIndex: null,
      history: {
        past: [...get().history.past, currentPresent].slice(-50),
        present: createSnapshot(newInput),
        future: [],
      },
    });
  },

  // Set entire video input
  setVideoInput: (input) => {
    const currentPresent = get().history.present;
    set({
      videoInput: input,
      history: {
        past: [...get().history.past, currentPresent].slice(-50),
        present: createSnapshot(input),
        future: [],
      },
    });
  },
  
  // Update video meta
  updateVideoMeta: (meta) => {
    const currentPresent = get().history.present;
    const newInput = {
      ...get().videoInput,
      videoMeta: { ...get().videoInput.videoMeta, ...meta },
    };
    set({
      videoInput: newInput,
      history: {
        past: [...get().history.past, currentPresent].slice(-50),
        present: createSnapshot(newInput),
        future: [],
      },
    });
  },
  
  // Add a new block
  addBlock: (type) => {
    const template = BLOCK_TEMPLATES[type];
    if (!template) return;
    
    const currentPresent = get().history.present;
    // Merge template with default customization values
    const newBlock = { 
      ...DEFAULT_CUSTOMIZATION,
      ...template 
    } as ContentBlock;
    const newInput = {
      ...get().videoInput,
      contentBlocks: [...get().videoInput.contentBlocks, newBlock],
    };
    
    set({
      videoInput: newInput,
      selectedBlockIndex: newInput.contentBlocks.length - 1,
      isDirty: true,
      history: {
        past: [...get().history.past, currentPresent].slice(-50),
        present: createSnapshot(newInput),
        future: [],
      },
    });
  },

  addPluginBlock: (pluginId, defaults) => {
    const currentPresent = get().history.present;
    const newBlock: CustomPluginBlock = {
      type: 'custom-plugin',
      pluginId,
      pluginData: defaults,
      ...DEFAULT_CUSTOMIZATION,
    } as CustomPluginBlock;
    const newInput = {
      ...get().videoInput,
      contentBlocks: [...get().videoInput.contentBlocks, newBlock],
    };
    set({
      videoInput: newInput,
      selectedBlockIndex: newInput.contentBlocks.length - 1,
      isDirty: true,
      history: {
        past: [...get().history.past, currentPresent].slice(-50),
        present: createSnapshot(newInput),
        future: [],
      },
    });
  },

  // Update a block
  updateBlock: (index, blockUpdate) => {
    const blocks = get().videoInput.contentBlocks;
    if (index < 0 || index >= blocks.length) return;
    
    const currentPresent = get().history.present;
    const newBlocks = [...blocks];
    newBlocks[index] = { ...newBlocks[index], ...blockUpdate } as ContentBlock;
    
    const newInput = {
      ...get().videoInput,
      contentBlocks: newBlocks,
    };
    
    set({
      videoInput: newInput,
      history: {
        past: [...get().history.past, currentPresent].slice(-50),
        present: createSnapshot(newInput),
        future: [],
      },
    });
  },
  
  // Remove a block
  removeBlock: (index) => {
    const blocks = get().videoInput.contentBlocks;
    if (index < 0 || index >= blocks.length) return;
    
    const currentPresent = get().history.present;
    const newBlocks = blocks.filter((_, i) => i !== index);
    
    const newInput = {
      ...get().videoInput,
      contentBlocks: newBlocks,
    };
    
    set({
      videoInput: newInput,
      selectedBlockIndex: null,
      history: {
        past: [...get().history.past, currentPresent].slice(-50),
        present: createSnapshot(newInput),
        future: [],
      },
    });
  },
  
  // Duplicate a block
  duplicateBlock: (index) => {
    const blocks = get().videoInput.contentBlocks;
    if (index < 0 || index >= blocks.length) return;
    
    const currentPresent = get().history.present;
    const blockToCopy = JSON.parse(JSON.stringify(blocks[index]));
    const newBlocks = [...blocks, blockToCopy];
    
    const newInput = {
      ...get().videoInput,
      contentBlocks: newBlocks,
    };
    
    set({
      videoInput: newInput,
      selectedBlockIndex: newBlocks.length - 1,
      history: {
        past: [...get().history.past, currentPresent].slice(-50),
        present: createSnapshot(newInput),
        future: [],
      },
    });
  },
  
  // Move a block
  moveBlock: (fromIndex, toIndex) => {
    const blocks = get().videoInput.contentBlocks;
    if (fromIndex < 0 || fromIndex >= blocks.length) return;
    if (toIndex < 0 || toIndex >= blocks.length) return;
    
    const currentPresent = get().history.present;
    const newBlocks = [...blocks];
    const [movedBlock] = newBlocks.splice(fromIndex, 1);
    newBlocks.splice(toIndex, 0, movedBlock);
    
    const newInput = {
      ...get().videoInput,
      contentBlocks: newBlocks,
    };
    
    set({
      videoInput: newInput,
      history: {
        past: [...get().history.past, currentPresent].slice(-50),
        present: createSnapshot(newInput),
        future: [],
      },
    });
  },
  
  // Select a block
  selectBlock: (index) => {
    set({ selectedBlockIndex: index });
  },
  
  // Audio Track actions
  addAudioTrack: (track) => {
    const currentPresent = get().history.present;
    const newTrack: AudioTrack = {
      ...track,
      id: `audio-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
    
    const currentTracks = get().videoInput.videoMeta.audioTracks || [];
    const newInput = {
      ...get().videoInput,
      videoMeta: {
        ...get().videoInput.videoMeta,
        audioTracks: [...currentTracks, newTrack],
      },
    };
    
    set({
      videoInput: newInput,
      history: {
        past: [...get().history.past, currentPresent].slice(-50),
        present: createSnapshot(newInput),
        future: [],
      },
    });
  },
  
  updateAudioTrack: (trackId, trackUpdate) => {
    const currentTracks = get().videoInput.videoMeta.audioTracks || [];
    const trackIndex = currentTracks.findIndex(t => t.id === trackId);
    if (trackIndex === -1) return;
    
    const currentPresent = get().history.present;
    const newTracks = [...currentTracks];
    newTracks[trackIndex] = { ...newTracks[trackIndex], ...trackUpdate };
    
    const newInput = {
      ...get().videoInput,
      videoMeta: {
        ...get().videoInput.videoMeta,
        audioTracks: newTracks,
      },
    };
    
    set({
      videoInput: newInput,
      history: {
        past: [...get().history.past, currentPresent].slice(-50),
        present: createSnapshot(newInput),
        future: [],
      },
    });
  },
  
  removeAudioTrack: (trackId) => {
    const currentTracks = get().videoInput.videoMeta.audioTracks || [];
    const trackIndex = currentTracks.findIndex(t => t.id === trackId);
    if (trackIndex === -1) return;
    
    const currentPresent = get().history.present;
    const newTracks = currentTracks.filter(t => t.id !== trackId);
    
    const newInput = {
      ...get().videoInput,
      videoMeta: {
        ...get().videoInput.videoMeta,
        audioTracks: newTracks,
      },
    };
    
    set({
      videoInput: newInput,
      history: {
        past: [...get().history.past, currentPresent].slice(-50),
        present: createSnapshot(newInput),
        future: [],
      },
    });
  },
  
  moveAudioTrack: (fromIndex, toIndex) => {
    const currentTracks = get().videoInput.videoMeta.audioTracks || [];
    if (fromIndex < 0 || fromIndex >= currentTracks.length) return;
    if (toIndex < 0 || toIndex >= currentTracks.length) return;
    
    const currentPresent = get().history.present;
    const newTracks = [...currentTracks];
    const [movedTrack] = newTracks.splice(fromIndex, 1);
    newTracks.splice(toIndex, 0, movedTrack);
    
    const newInput = {
      ...get().videoInput,
      videoMeta: {
        ...get().videoInput.videoMeta,
        audioTracks: newTracks,
      },
    };
    
    set({
      videoInput: newInput,
      history: {
        past: [...get().history.past, currentPresent].slice(-50),
        present: createSnapshot(newInput),
        future: [],
      },
    });
  },
  
  // Playback controls
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setCurrentTime: (time) => set({ currentTime: time }),
  setIsDirty: (dirty) => set({ isDirty: dirty }),

  // Set export job status
  setExportJobStatus: (status, jobId = null) => set({
    exportJobStatus: status,
    exportJobId: jobId !== undefined ? jobId : get().exportJobId,
    ...(status === 'idle' ? { exportProgress: 0, exportOutputUrl: null } : {}),
  }),
  
  // Undo
  undo: () => {
    const { past, present, future } = get().history;
    if (past.length === 0) return;
    
    const previous = past[past.length - 1];
    const newPast = past.slice(0, -1);
    
    set({
      videoInput: previous,
      history: {
        past: newPast,
        present: previous,
        future: [present, ...future],
      },
    });
  },
  
  // Redo
  redo: () => {
    const { past, present, future } = get().history;
    if (future.length === 0) return;
    
    const next = future[0];
    const newFuture = future.slice(1);
    
    set({
      videoInput: next,
      history: {
        past: [...past, present],
        present: next,
        future: newFuture,
      },
    });
  },
  
  // Check if can undo
  canUndo: () => get().history.past.length > 0,
  
  // Check if can redo
  canRedo: () => get().history.future.length > 0,
  
  // Get video JSON
  getVideoJson: () => {
    return JSON.stringify(get().videoInput, null, 2);
  },
  
  // Export video - uses Lambda (polling) or local renderer
  exportVideo: async () => {
    const { setExportJobStatus } = get();
    try {
      setExportJobStatus('processing', null);
      set({ exportProgress: 0, exportOutputUrl: null });
      const videoInput = get().videoInput;

      // Stage the payload first to avoid Vercel's 4.5MB body limit,
      // then send just the payloadId to the generate endpoint.
      const payload = JSON.stringify(videoInput);
      let generateBody: string;

      if (payload.length > 3_500_000) {
        // Large payload — stage it in the DB first
        const stageRes = await fetch('/api/video/stage-payload', {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: payload,
        });
        if (!stageRes.ok) throw new Error('Failed to stage payload');
        const { payloadId } = await stageRes.json();
        generateBody = JSON.stringify({ payloadId });
      } else {
        generateBody = payload;
      }

      const startRes = await fetch('/api/video/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: generateBody,
      });

      if (!startRes.ok) {
        const err = await startRes.json().catch(() => ({}));
        throw new Error(err.message || err.error || 'Failed to start render');
      }

      const startData = await startRes.json();

      if (startData.usedLambda) {
        // Lambda path: poll for completion
        const { renderId, bucketName, region, videoId } = startData;
        setExportJobStatus('processing', renderId);

        let outputFile: string | null = null;
        while (!outputFile) {
          await new Promise(r => setTimeout(r, 4000));
          const progressRes = await fetch(
            `/api/video/render-lambda/progress?renderId=${renderId}&bucketName=${encodeURIComponent(bucketName)}&region=${region}`
          );
          if (!progressRes.ok) throw new Error('Failed to get render progress');
          const progress = await progressRes.json();
          if (progress.fatalErrorEncountered || progress.errors?.length) {
            throw new Error(progress.errors?.[0]?.message || 'Lambda render failed');
          }
          // Update progress (0–100)
          if (typeof progress.overallProgress === 'number') {
            set({ exportProgress: Math.round(progress.overallProgress * 100) });
          }
          if (progress.done && progress.outputFile) {
            outputFile = progress.outputFile;
          }
        }

        // Update video record with final S3 URL
        if (videoId) {
          await fetch(`/api/user/videos/${videoId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: outputFile }),
          }).catch(() => {});
        }

        set({ exportOutputUrl: outputFile, exportProgress: 100 });
        setExportJobStatus('completed', renderId);
      } else {
        // Local path
        set({ exportOutputUrl: startData.videoUrl, exportProgress: 100 });
        setExportJobStatus('completed', null);
      }
      return null;
    } catch (error) {
      console.error('Export failed:', error);
      setExportJobStatus('failed', null);
      return null;
    }
  },

  // Trigger browser download from exportOutputUrl
  downloadExport: () => {
    const { exportOutputUrl } = get();
    if (!exportOutputUrl) return;
    const a = document.createElement('a');
    a.href = exportOutputUrl;
    a.download = 'video.mp4';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  },
}));
