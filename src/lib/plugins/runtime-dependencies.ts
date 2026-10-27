import React from 'react';
import * as ReactDOM from 'react-dom';
import * as ReactDOMClient from 'react-dom/client';
import * as jsxRuntime from 'react/jsx-runtime';
import * as jsxDevRuntime from 'react/jsx-dev-runtime';
import * as Remotion from 'remotion';
import * as RemotionNoReact from 'remotion/no-react';
import * as Player from '@remotion/player';
import * as Media from '@remotion/media';
import * as MediaUtils from '@remotion/media-utils';
import * as Sfx from '@remotion/sfx';
import * as RemotionThree from '@remotion/three';
import * as Lottie from '@remotion/lottie';
import * as MotionBlur from '@remotion/motion-blur';
import * as Transitions from '@remotion/transitions';
import * as FramerMotion from 'framer-motion';
import * as Three from 'three';
import * as Fiber from '@react-three/fiber';
import * as Drei from '@react-three/drei';
import * as ReactPostprocessing from '@react-three/postprocessing';
import * as Postprocessing from 'postprocessing';
import type { PluginRuntimeImport } from './runtime-contract';

// One map for both players. The type check makes additions to the build
// contract require a matching implementation here.
export const pluginRuntimeDependencies = {
  react: React,
  'react-dom': ReactDOM,
  'react-dom/client': ReactDOMClient,
  'react/jsx-runtime': jsxRuntime,
  'react/jsx-dev-runtime': jsxDevRuntime,
  remotion: Remotion,
  'remotion/no-react': RemotionNoReact,
  '@remotion/player': Player,
  '@remotion/media': Media,
  '@remotion/media-utils': MediaUtils,
  '@remotion/sfx': Sfx,
  '@remotion/three': RemotionThree,
  '@remotion/lottie': Lottie,
  '@remotion/motion-blur': MotionBlur,
  '@remotion/transitions': Transitions,
  'framer-motion': FramerMotion,
  three: Three,
  '@react-three/fiber': Fiber,
  '@react-three/drei': Drei,
  '@react-three/postprocessing': ReactPostprocessing,
  postprocessing: Postprocessing,
} satisfies Record<PluginRuntimeImport, unknown>;
