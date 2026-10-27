import { ContentBlock, VideoMeta, AudioTrack } from '../schemas';

/**
 * Advanced Template - Uses parallax-story with full configuration
 * Similar to the Prophet Yusuf example you provided
 */

export interface AdvancedTemplateVariable {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'image' | 'audio' | 'url';
  placeholder?: string;
  required: boolean;
  description?: string;
}

export interface AdvancedVideoTemplate {
  id: string;
  name: string;
  description: string;
  category: 'story' | 'documentary' | 'educational' | 'religious' | 'movie';
  thumbnail?: string;
  videoMeta: VideoMeta;
  // Template scenes - each scene has placeholder content that AI fills
  scenes: AdvancedSceneTemplate[];
  // Variables needed from user
  requiredVariables: AdvancedTemplateVariable[];
}

export interface AdvancedSceneTemplate {
  // Scene metadata
  title: string;
  subtitle: string; // e.g., "Opening", "Rising", "Climax", "Falling", "Resolution"
  duration: number;

  // Parallax layers with {{variable}} placeholders
  layers: {
    id: string;
    name: string;
    image?: string; // Can be {{backgroundImage}}, {{foregroundImage}}, etc.
    depth: number;
    parallaxFactor: number;
    scale: number;
    opacity: number;
    positionX: number;
    positionY: number;
    motionEnabled: boolean;
    motionDirection: string;
    motionSpeed: number;
    motionIntensity: number;
    animationIn: string;
    animationOut: string;
    animationDelay: number;
    animationDuration: number;
    imageFit: string;
  }[];

  // Camera & effects
  cameraMovement: string;
  cameraSpeed: number;
  cameraIntensity: number;
  effects: string[];
  effectIntensity: number;

  // Text overlays
  textOverlays: {
    text: string; // {{sceneScript}}
    position: string;
    fontSize: string;
    fontWeight: string;
    color: string;
    shadow: boolean;
    textAlign: string;
    animation: string;
    animationDelay: number;
    duration: number;
    startTime: number;
  }[];

  // Audio - can be user provided or AI generated
  audioSrc?: string; // {{sceneAudio}}
  audioStartTime: number;
  audioDelay: number;
  audioLoop: boolean;

  // Text styling
  textColor: string;
  textPosition: string;
  text?: string; // {{sceneScript}}
  textMode: string;
  textFontSize: string;
  textFontWeight: string;
  textStyle: string;
  textAnimationDelay: number;

  // Visual
  colorGrade: string;
  colorIntensity: number;
  backgroundColor: string;
  fitMode: string;
}

// =============================================================================
// ADVANCED PUBLIC TEMPLATES
// =============================================================================

export const ADVANCED_TEMPLATES: AdvancedVideoTemplate[] = [
  {
    id: 'prophet-story',
    name: 'Prophet Stories',
    description: 'Beautiful animated religious stories with parallax scenes, TTS narration, and cinematic effects',
    category: 'religious',
    thumbnail: '/templates/prophet-thumb.jpg',
    videoMeta: {
      aspectRatio: '9:16',
      theme: 'dark_modern',
      fps: 30,
      intro: {
        title: 'Prophet Stories',
        subtitle: 'Divine Tales',
        duration: 2,
      },
      outro: {
        title: 'Follow for More!',
        subtitle: 'Daily Inspiration',
        duration: 2,
      },
      audioTracks: [],
    },
    scenes: [
      {
        title: 'Beloved Son\'s Dream',
        subtitle: 'Opening',
        duration: 21,
        layers: [
          {
            id: 'background',
            name: 'Background',
            image: '{{scene1_background}}',
            depth: 100,
            parallaxFactor: 0.5,
            cameraIntensity: 2,
            scale: 2.9,
            opacity: 1,
            positionX: 0,
            positionY: 0,
            motionEnabled: true,
            motionDirection: 'right',
            motionSpeed: 1,
            motionIntensity: 0.8,
            animationIn: 'fade',
            animationOut: 'fade',
            animationDelay: 0,
            animationDuration: 1,
            animationEasing: 'ease-out',
            imageFit: 'cover',
          },
          {
            id: 'midscene',
            name: 'Mid Scene',
            image: '{{scene1_mid}}',
            depth: 50,
            parallaxFactor: 1,
            cameraIntensity: 1,
            scale: 1.5,
            opacity: 1,
            positionX: 0,
            positionY: 10,
            motionEnabled: true,
            motionDirection: 'left',
            motionSpeed: 0.8,
            motionIntensity: 1,
            animationIn: 'slide-up',
            animationOut: 'fade',
            animationDelay: 0.5,
            animationDuration: 1,
            animationEasing: 'ease-in-out',
            imageFit: 'contain',
          },
          {
            id: 'foreground',
            name: 'Foreground Subject',
            image: '{{scene1_foreground}}',
            depth: 5,
            parallaxFactor: 3,
            cameraIntensity: 0,
            scale: 1,
            opacity: 1,
            positionX: 2,
            positionY: 35,
            motionEnabled: true,
            motionDirection: 'left',
            motionSpeed: 1,
            motionIntensity: 0.5,
            animationIn: 'blur-in',
            animationOut: 'fade',
            animationDelay: 0.6,
            animationDuration: 0.8,
            animationEasing: 'linear',
            imageFit: 'contain',
          },
        ],
        cameraMovement: 'zoom-in',
        cameraSpeed: 0.2,
        cameraIntensity: 1.9,
        effects: ['vignette', 'particles'],
        effectIntensity: 0.5,
        textOverlays: [
          {
            text: 'Beloved Son\'s Dream',
            position: 'center',
            fontSize: 'xlarge',
            fontWeight: 'bold',
            color: '#FFFFFF',
            shadow: true,
            textAlign: 'center',
            animation: 'fade',
            animationDelay: 1,
            duration: 3,
            startTime: 0,
          },
          {
            text: '{{scene1_script}}',
            position: 'bottom',
            fontSize: 'large',
            fontWeight: 'normal',
            color: '#FFFFFF',
            shadow: true,
            textAlign: 'center',
            animation: 'slide-up',
            animationDelay: 0.5,
            duration: 3,
            startTime: 3,
          },
        ],
        audioSrc: '{{scene1_audio}}',
        audioStartTime: 0,
        audioDelay: 1,
        audioLoop: false,
        textColor: '#D2AF26',
        textPosition: 'bottom',
        text: '{{scene1_script}}',
        textMode: 'overall',
        textFontSize: 'medium',
        textFontWeight: 'normal',
        textStyle: 'typing',
        textAnimationDelay: 1.2,
        colorGrade: 'cinematic',
        colorIntensity: 0.4,
        backgroundColor: '#000000',
        fitMode: 'cover',
      },
      {
        title: 'Brothers\' Jealousy',
        subtitle: 'Rising',
        duration: 21,
        layers: [
          {
            id: 'background',
            name: 'Background',
            image: '{{scene2_background}}',
            depth: 100,
            parallaxFactor: 0.5,
            cameraIntensity: 2,
            scale: 2.9,
            opacity: 1,
            positionX: 0,
            positionY: 0,
            motionEnabled: true,
            motionDirection: 'left',
            motionSpeed: 1,
            motionIntensity: 0.8,
            animationIn: 'fade',
            animationOut: 'fade',
            animationDelay: 0,
            animationDuration: 1,
            animationEasing: 'ease-out',
            imageFit: 'cover',
          },
          {
            id: 'midscene',
            name: 'Mid Scene',
            image: '{{scene2_mid}}',
            depth: 50,
            parallaxFactor: 1,
            cameraIntensity: 1,
            scale: 1.5,
            opacity: 1,
            positionX: 0,
            positionY: 10,
            motionEnabled: true,
            motionDirection: 'right',
            motionSpeed: 0.8,
            motionIntensity: 1,
            animationIn: 'slide-up',
            animationOut: 'fade',
            animationDelay: 0.5,
            animationDuration: 1,
            animationEasing: 'ease-in-out',
            imageFit: 'contain',
          },
          {
            id: 'foreground',
            name: 'Foreground Subject',
            image: '{{scene2_foreground}}',
            depth: 5,
            parallaxFactor: 3,
            cameraIntensity: 0,
            scale: 1,
            opacity: 1,
            positionX: 2,
            positionY: 35,
            motionEnabled: true,
            motionDirection: 'left',
            motionSpeed: 1,
            motionIntensity: 0.5,
            animationIn: 'blur-in',
            animationOut: 'fade',
            animationDelay: 0.6,
            animationDuration: 0.8,
            animationEasing: 'linear',
            imageFit: 'contain',
          },
        ],
        cameraMovement: 'pan-left',
        cameraSpeed: 0.2,
        cameraIntensity: 1.9,
        effects: ['vignette', 'particles'],
        effectIntensity: 0.5,
        textOverlays: [
          {
            text: 'Brothers\' Jealousy',
            position: 'center',
            fontSize: 'xlarge',
            fontWeight: 'bold',
            color: '#FFFFFF',
            shadow: true,
            textAlign: 'center',
            animation: 'fade',
            animationDelay: 1,
            duration: 3,
            startTime: 0,
          },
          {
            text: '{{scene2_script}}',
            position: 'bottom',
            fontSize: 'large',
            fontWeight: 'normal',
            color: '#FFFFFF',
            shadow: true,
            textAlign: 'center',
            animation: 'slide-up',
            animationDelay: 0.5,
            duration: 3,
            startTime: 3,
          },
        ],
        audioSrc: '{{scene2_audio}}',
        audioStartTime: 0,
        audioDelay: 1,
        audioLoop: false,
        textColor: '#D2AF26',
        textPosition: 'bottom',
        text: '{{scene2_script}}',
        textMode: 'overall',
        textFontSize: 'medium',
        textFontWeight: 'normal',
        textStyle: 'typing',
        textAnimationDelay: 1.2,
        colorGrade: 'cinematic',
        colorIntensity: 0.4,
        backgroundColor: '#000000',
        fitMode: 'cover',
      },
      {
        title: 'Into the Abyss',
        subtitle: 'Climax',
        duration: 21,
        layers: [
          {
            id: 'background',
            name: 'Background',
            image: '{{scene3_background}}',
            depth: 100,
            parallaxFactor: 0.5,
            cameraIntensity: 2,
            scale: 2.9,
            opacity: 1,
            positionX: 0,
            positionY: 0,
            motionEnabled: true,
            motionDirection: 'right',
            motionSpeed: 1,
            motionIntensity: 0.8,
            animationIn: 'fade',
            animationOut: 'fade',
            animationDelay: 0,
            animationDuration: 1,
            animationEasing: 'ease-out',
            imageFit: 'cover',
          },
          {
            id: 'midscene',
            name: 'Mid Scene',
            image: '{{scene3_mid}}',
            depth: 50,
            parallaxFactor: 1,
            cameraIntensity: 1,
            scale: 1.5,
            opacity: 1,
            positionX: 0,
            positionY: 10,
            motionEnabled: true,
            motionDirection: 'left',
            motionSpeed: 0.8,
            motionIntensity: 1,
            animationIn: 'slide-up',
            animationOut: 'fade',
            animationDelay: 0.5,
            animationDuration: 1,
            animationEasing: 'ease-in-out',
            imageFit: 'contain',
          },
          {
            id: 'foreground',
            name: 'Foreground Subject',
            image: '{{scene3_foreground}}',
            depth: 5,
            parallaxFactor: 3,
            cameraIntensity: 0,
            scale: 1,
            opacity: 1,
            positionX: 2,
            positionY: 35,
            motionEnabled: true,
            motionDirection: 'left',
            motionSpeed: 1,
            motionIntensity: 0.5,
            animationIn: 'blur-in',
            animationOut: 'fade',
            animationDelay: 0.6,
            animationDuration: 0.8,
            animationEasing: 'linear',
            imageFit: 'contain',
          },
        ],
        cameraMovement: 'zoom-in',
        cameraSpeed: 0.2,
        cameraIntensity: 1.9,
        effects: ['vignette', 'particles'],
        effectIntensity: 0.5,
        textOverlays: [
          {
            text: 'Into the Abyss',
            position: 'center',
            fontSize: 'xlarge',
            fontWeight: 'bold',
            color: '#FFFFFF',
            shadow: true,
            textAlign: 'center',
            animation: 'fade',
            animationDelay: 1,
            duration: 3,
            startTime: 0,
          },
          {
            text: '{{scene3_script}}',
            position: 'bottom',
            fontSize: 'large',
            fontWeight: 'normal',
            color: '#FFFFFF',
            shadow: true,
            textAlign: 'center',
            animation: 'slide-up',
            animationDelay: 0.5,
            duration: 3,
            startTime: 3,
          },
        ],
        audioSrc: '{{scene3_audio}}',
        audioStartTime: 0,
        audioDelay: 1,
        audioLoop: false,
        textColor: '#D2AF26',
        textPosition: 'bottom',
        text: '{{scene3_script}}',
        textMode: 'overall',
        textFontSize: 'medium',
        textFontWeight: 'normal',
        textStyle: 'typing',
        textAnimationDelay: 1.2,
        colorGrade: 'cinematic',
        colorIntensity: 0.4,
        backgroundColor: '#000000',
        fitMode: 'cover',
      },
      {
        title: 'Alone in Darkness',
        subtitle: 'Falling',
        duration: 21,
        layers: [
          {
            id: 'background',
            name: 'Background',
            image: '{{scene4_background}}',
            depth: 100,
            parallaxFactor: 0.5,
            cameraIntensity: 2,
            scale: 2.9,
            opacity: 1,
            positionX: 0,
            positionY: 0,
            motionEnabled: true,
            motionDirection: 'left',
            motionSpeed: 1,
            motionIntensity: 0.8,
            animationIn: 'fade',
            animationOut: 'fade',
            animationDelay: 0,
            animationDuration: 1,
            animationEasing: 'ease-out',
            imageFit: 'cover',
          },
          {
            id: 'midscene',
            name: 'Mid Scene',
            image: '{{scene4_mid}}',
            depth: 50,
            parallaxFactor: 1,
            cameraIntensity: 1,
            scale: 1.5,
            opacity: 1,
            positionX: 0,
            positionY: 10,
            motionEnabled: true,
            motionDirection: 'right',
            motionSpeed: 0.8,
            motionIntensity: 1,
            animationIn: 'slide-up',
            animationOut: 'fade',
            animationDelay: 0.5,
            animationDuration: 1,
            animationEasing: 'ease-in-out',
            imageFit: 'contain',
          },
          {
            id: 'foreground',
            name: 'Foreground Subject',
            image: '{{scene4_foreground}}',
            depth: 5,
            parallaxFactor: 3,
            cameraIntensity: 0,
            scale: 1,
            opacity: 1,
            positionX: 2,
            positionY: 35,
            motionEnabled: true,
            motionDirection: 'left',
            motionSpeed: 1,
            motionIntensity: 0.5,
            animationIn: 'blur-in',
            animationOut: 'fade',
            animationDelay: 0.6,
            animationDuration: 0.8,
            animationEasing: 'linear',
            imageFit: 'contain',
          },
        ],
        cameraMovement: 'zoom-out',
        cameraSpeed: 0.2,
        cameraIntensity: 1.9,
        effects: ['vignette', 'particles'],
        effectIntensity: 0.5,
        textOverlays: [
          {
            text: 'Alone in Darkness',
            position: 'center',
            fontSize: 'xlarge',
            fontWeight: 'bold',
            color: '#FFFFFF',
            shadow: true,
            textAlign: 'center',
            animation: 'fade',
            animationDelay: 1,
            duration: 3,
            startTime: 0,
          },
          {
            text: '{{scene4_script}}',
            position: 'bottom',
            fontSize: 'large',
            fontWeight: 'normal',
            color: '#FFFFFF',
            shadow: true,
            textAlign: 'center',
            animation: 'slide-up',
            animationDelay: 0.5,
            duration: 3,
            startTime: 3,
          },
        ],
        audioSrc: '{{scene4_audio}}',
        audioStartTime: 0,
        audioDelay: 1,
        audioLoop: false,
        textColor: '#D2AF26',
        textPosition: 'bottom',
        text: '{{scene4_script}}',
        textMode: 'overall',
        textFontSize: 'medium',
        textFontWeight: 'normal',
        textStyle: 'typing',
        textAnimationDelay: 1.2,
        colorGrade: 'cinematic',
        colorIntensity: 0.4,
        backgroundColor: '#000000',
        fitMode: 'cover',
      },
    ],
    requiredVariables: [
      // Story context
      { key: 'storyTitle', label: 'Story Title', type: 'text', required: true, description: 'Title of the story' },
      { key: 'storyTopic', label: 'Story Topic/Theme', type: 'textarea', required: true, description: 'What is the story about?' },

      // Scene 1 - Opening
      { key: 'scene1_title', label: 'Scene 1 Title', type: 'text', required: true, placeholder: 'e.g., Beloved Son\'s Dream' },
      { key: 'scene1_script', label: 'Scene 1 Script', type: 'textarea', required: true, description: 'Narration for scene 1' },
      { key: 'scene1_background', label: 'Scene 1 Background Image', type: 'image', required: false, description: 'Background image URL' },
      { key: 'scene1_mid', label: 'Scene 1 Mid Layer Image', type: 'image', required: false },
      { key: 'scene1_foreground', label: 'Scene 1 Foreground Image', type: 'image', required: false },
      { key: 'scene1_audio', label: 'Scene 1 Audio (TTS)', type: 'audio', required: false, description: 'TTS audio URL' },

      // Scene 2 - Rising
      { key: 'scene2_title', label: 'Scene 2 Title', type: 'text', required: true },
      { key: 'scene2_script', label: 'Scene 2 Script', type: 'textarea', required: true },
      { key: 'scene2_background', label: 'Scene 2 Background Image', type: 'image', required: false },
      { key: 'scene2_mid', label: 'Scene 2 Mid Layer Image', type: 'image', required: false },
      { key: 'scene2_foreground', label: 'Scene 2 Foreground Image', type: 'image', required: false },
      { key: 'scene2_audio', label: 'Scene 2 Audio (TTS)', type: 'audio', required: false },

      // Scene 3 - Climax
      { key: 'scene3_title', label: 'Scene 3 Title', type: 'text', required: true },
      { key: 'scene3_script', label: 'Scene 3 Script', type: 'textarea', required: true },
      { key: 'scene3_background', label: 'Scene 3 Background Image', type: 'image', required: false },
      { key: 'scene3_mid', label: 'Scene 3 Mid Layer Image', type: 'image', required: false },
      { key: 'scene3_foreground', label: 'Scene 3 Foreground Image', type: 'image', required: false },
      { key: 'scene3_audio', label: 'Scene 3 Audio (TTS)', type: 'audio', required: false },

      // Scene 4 - Falling
      { key: 'scene4_title', label: 'Scene 4 Title', type: 'text', required: true },
      { key: 'scene4_script', label: 'Scene 4 Script', type: 'textarea', required: true },
      { key: 'scene4_background', label: 'Scene 4 Background Image', type: 'image', required: false },
      { key: 'scene4_mid', label: 'Scene 4 Mid Layer Image', type: 'image', required: false },
      { key: 'scene4_foreground', label: 'Scene 4 Foreground Image', type: 'image', required: false },
      { key: 'scene4_audio', label: 'Scene 4 Audio (TTS)', type: 'audio', required: false },
    ],
  },
  {
    id: 'documentary',
    name: 'Documentary Style',
    description: 'Cinematic documentary with multiple scenes, narration, and dramatic visuals',
    category: 'documentary',
    thumbnail: '/templates/doc-thumb.jpg',
    videoMeta: {
      aspectRatio: '9:16',
      theme: 'dark_modern',
      fps: 30,
      intro: {
        title: 'Documentary',
        subtitle: 'A True Story',
        duration: 2,
      },
      outro: {
        title: 'The End',
        subtitle: 'Based on True Events',
        duration: 2,
      },
      audioTracks: [],
    },
    scenes: [
      {
        title: 'The Beginning',
        subtitle: 'Introduction',
        duration: 15,
        layers: [
          {
            id: 'background',
            name: 'Background',
            image: '{{scene1_background}}',
            depth: 100,
            parallaxFactor: 0.3,
            cameraIntensity: 1,
            scale: 2,
            opacity: 1,
            positionX: 0,
            positionY: 0,
            motionEnabled: true,
            motionDirection: 'up',
            motionSpeed: 0.3,
            motionIntensity: 0.3,
            animationIn: 'fade',
            animationOut: 'fade',
            animationDelay: 0,
            animationDuration: 1,
            imageFit: 'cover',
          },
        ],
        cameraMovement: 'slow-pan-up',
        cameraSpeed: 0.3,
        cameraIntensity: 1,
        effects: ['vignette'],
        effectIntensity: 0.3,
        textOverlays: [
          {
            text: '{{scene1_title}}',
            position: 'center',
            fontSize: 'xlarge',
            fontWeight: 'bold',
            color: '#FFFFFF',
            shadow: true,
            textAlign: 'center',
            animation: 'fade',
            animationDelay: 0.5,
            duration: 3,
            startTime: 0,
          },
          {
            text: '{{scene1_script}}',
            position: 'bottom',
            fontSize: 'medium',
            fontWeight: 'normal',
            color: '#CCCCCC',
            shadow: true,
            textAlign: 'center',
            animation: 'slide-up',
            animationDelay: 1,
            duration: 5,
            startTime: 3,
          },
        ],
        audioSrc: '{{scene1_audio}}',
        audioStartTime: 0,
        audioDelay: 0,
        audioLoop: false,
        textColor: '#FFFFFF',
        textPosition: 'bottom',
        text: '{{scene1_script}}',
        textMode: 'overlay',
        textFontSize: 'medium',
        textFontWeight: 'normal',
        textStyle: 'fade',
        textAnimationDelay: 1,
        colorGrade: 'cinematic',
        colorIntensity: 0.5,
        backgroundColor: '#000000',
        fitMode: 'cover',
      },
      {
        title: 'The Journey',
        subtitle: 'Main Story',
        duration: 20,
        layers: [
          {
            id: 'background',
            name: 'Background',
            image: '{{scene2_background}}',
            depth: 100,
            parallaxFactor: 0.5,
            cameraIntensity: 1.5,
            scale: 2.5,
            opacity: 1,
            positionX: 0,
            positionY: 0,
            motionEnabled: true,
            motionDirection: 'right',
            motionSpeed: 0.5,
            motionIntensity: 0.5,
            animationIn: 'fade',
            animationOut: 'fade',
            animationDelay: 0,
            animationDuration: 1,
            imageFit: 'cover',
          },
        ],
        cameraMovement: 'pan-right',
        cameraSpeed: 0.4,
        cameraIntensity: 1.5,
        effects: ['vignette', 'film-grain'],
        effectIntensity: 0.4,
        textOverlays: [
          {
            text: '{{scene2_title}}',
            position: 'center',
            fontSize: 'large',
            fontWeight: 'bold',
            color: '#FFFFFF',
            shadow: true,
            textAlign: 'center',
            animation: 'fade',
            animationDelay: 0.5,
            duration: 3,
            startTime: 0,
          },
          {
            text: '{{scene2_script}}',
            position: 'bottom',
            fontSize: 'medium',
            fontWeight: 'normal',
            color: '#CCCCCC',
            shadow: true,
            textAlign: 'center',
            animation: 'slide-up',
            animationDelay: 1,
            duration: 5,
            startTime: 3,
          },
        ],
        audioSrc: '{{scene2_audio}}',
        audioStartTime: 0,
        audioDelay: 0,
        audioLoop: false,
        textColor: '#FFFFFF',
        textPosition: 'bottom',
        text: '{{scene2_script}}',
        textMode: 'overlay',
        textFontSize: 'medium',
        textFontWeight: 'normal',
        textStyle: 'fade',
        textAnimationDelay: 1,
        colorGrade: 'cinematic',
        colorIntensity: 0.6,
        backgroundColor: '#000000',
        fitMode: 'cover',
      },
      {
        title: 'The Resolution',
        subtitle: 'Conclusion',
        duration: 15,
        layers: [
          {
            id: 'background',
            name: 'Background',
            image: '{{scene3_background}}',
            depth: 100,
            parallaxFactor: 0.2,
            cameraIntensity: 0.8,
            scale: 1.8,
            opacity: 1,
            positionX: 0,
            positionY: 0,
            motionEnabled: true,
            motionDirection: 'up',
            motionSpeed: 0.2,
            motionIntensity: 0.2,
            animationIn: 'fade',
            animationOut: 'fade',
            animationDelay: 0,
            animationDuration: 1,
            imageFit: 'cover',
          },
        ],
        cameraMovement: 'zoom-out',
        cameraSpeed: 0.3,
        cameraIntensity: 1,
        effects: ['vignette'],
        effectIntensity: 0.3,
        textOverlays: [
          {
            text: '{{scene3_title}}',
            position: 'center',
            fontSize: 'large',
            fontWeight: 'bold',
            color: '#FFFFFF',
            shadow: true,
            textAlign: 'center',
            animation: 'fade',
            animationDelay: 0.5,
            duration: 3,
            startTime: 0,
          },
          {
            text: '{{scene3_script}}',
            position: 'bottom',
            fontSize: 'medium',
            fontWeight: 'normal',
            color: '#CCCCCC',
            shadow: true,
            textAlign: 'center',
            animation: 'slide-up',
            animationDelay: 1,
            duration: 5,
            startTime: 3,
          },
        ],
        audioSrc: '{{scene3_audio}}',
        audioStartTime: 0,
        audioDelay: 0,
        audioLoop: false,
        textColor: '#FFFFFF',
        textPosition: 'bottom',
        text: '{{scene3_script}}',
        textMode: 'overlay',
        textFontSize: 'medium',
        textFontWeight: 'normal',
        textStyle: 'fade',
        textAnimationDelay: 1,
        colorGrade: 'cinematic',
        colorIntensity: 0.4,
        backgroundColor: '#000000',
        fitMode: 'cover',
      },
    ],
    requiredVariables: [
      { key: 'storyTitle', label: 'Documentary Title', type: 'text', required: true },
      { key: 'storyTopic', label: 'Topic/Theme', type: 'textarea', required: true },

      { key: 'scene1_title', label: 'Scene 1 Title', type: 'text', required: true },
      { key: 'scene1_script', label: 'Scene 1 Script', type: 'textarea', required: true },
      { key: 'scene1_background', label: 'Scene 1 Background', type: 'image', required: false },
      { key: 'scene1_audio', label: 'Scene 1 Audio', type: 'audio', required: false },

      { key: 'scene2_title', label: 'Scene 2 Title', type: 'text', required: true },
      { key: 'scene2_script', label: 'Scene 2 Script', type: 'textarea', required: true },
      { key: 'scene2_background', label: 'Scene 2 Background', type: 'image', required: false },
      { key: 'scene2_audio', label: 'Scene 2 Audio', type: 'audio', required: false },

      { key: 'scene3_title', label: 'Scene 3 Title', type: 'text', required: true },
      { key: 'scene3_script', label: 'Scene 3 Script', type: 'textarea', required: true },
      { key: 'scene3_background', label: 'Scene 3 Background', type: 'image', required: false },
      { key: 'scene3_audio', label: 'Scene 3 Audio', type: 'audio', required: false },
    ],
  },
];

/**
 * Get advanced template by ID
 */
export function getAdvancedTemplateById(id: string): AdvancedVideoTemplate | undefined {
  return ADVANCED_TEMPLATES.find(t => t.id === id);
}

/**
 * Get templates by category
 */
export function getAdvancedTemplatesByCategory(category: string): AdvancedVideoTemplate[] {
  return ADVANCED_TEMPLATES.filter(t => t.category === category);
}

/**
 * Convert advanced template to content blocks (parallax-story blocks)
 */
export function convertTemplateToBlocks(
  template: AdvancedVideoTemplate,
  values: Record<string, string>
): ContentBlock[] {
  return template.scenes.map(scene => {
    // Resolve all {{variable}} patterns in the scene
    const resolveValue = (value: string): string => {
      if (typeof value !== 'string') return value;
      let resolved = value;
      Object.entries(values).forEach(([key, val]) => {
        resolved = resolved.replace(new RegExp(`{{${key}}}`, 'g'), val || '');
      });
      return resolved;
    };

    const resolvedLayers = scene.layers.map(layer => ({
      ...layer,
      image: resolveValue(layer.image || ''),
    }));

    const resolvedTextOverlays = scene.textOverlays.map(overlay => ({
      ...overlay,
      text: resolveValue(overlay.text),
    }));

    return {
      type: 'parallax-story' as const,
      title: resolveValue(scene.title),
      subtitle: resolveValue(scene.subtitle),
      layers: resolvedLayers,
      cameraMovement: scene.cameraMovement,
      cameraSpeed: scene.cameraSpeed,
      cameraIntensity: scene.cameraIntensity,
      effects: scene.effects,
      effectIntensity: scene.effectIntensity,
      textOverlays: resolvedTextOverlays,
      colorGrade: scene.colorGrade,
      colorIntensity: scene.colorIntensity,
      backgroundColor: scene.backgroundColor,
      fitMode: scene.fitMode,
      textMode: scene.textMode,
      text: resolveValue(scene.text || ''),
      textColor: scene.textColor,
      textPosition: scene.textPosition,
      textFontSize: scene.textFontSize,
      textFontWeight: scene.textFontWeight,
      textStyle: scene.textStyle,
      textAnimationDelay: scene.textAnimationDelay,
      audioSrc: resolveValue(scene.audioSrc || ''),
      audioStartTime: scene.audioStartTime,
      audioDelay: scene.audioDelay,
      audioLoop: scene.audioLoop,
      duration: scene.duration,
      enterAnimation: 'fade',
      exitAnimation: 'fade',
      animationDuration: 0.5,
      backgroundBlur: 0,
      borderWidth: 0,
      borderRadius: 0,
      shadowEnabled: false,
      shadowColor: 'rgba(0,0,0,0.5)',
      shadowBlur: 20,
      margin: 0,
    };
  });
}