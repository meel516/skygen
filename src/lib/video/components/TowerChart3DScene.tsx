// ============================================================================
// TOWER CHART 3D SCENE - Advanced Realistic 3D Ranking Visualization
// Enhanced with PBR materials, post-processing, and cinematic lighting
// ============================================================================

import React, { useMemo, useEffect, useState, Suspense, useRef, useCallback } from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, delayRender, continueRender, cancelRender } from 'remotion';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { Text, Box, Plane, Billboard, Stars, useGLTF, Environment, ContactShadows, Float, Sparkles, SpotLight, MeshReflectorMaterial } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, ChromaticAberration, DepthOfField, Noise, ToneMapping } from '@react-three/postprocessing';
import { BlendFunction, ToneMappingMode } from 'postprocessing';
import * as THREE from 'three';
import type { TowerChart3DBlock, AnimationPhase } from '../schemas';
import type { MotionProfileType } from '../utils/animations';

// ============================================================================
// CUSTOM SHADERS FOR ADVANCED EFFECTS
// ============================================================================

// Glow Grid Shader Material
const glowGridShader = {
  uniforms: {
    uTime: { value: 0 },
    uColor1: { value: new THREE.Color('#00ffff') },
    uColor2: { value: new THREE.Color('#ff00ff') },
    uFadeDistance: { value: 80.0 },
  },
  vertexShader: `
    varying vec2 vUv;
    varying float vDistance;
    void main() {
      vUv = uv;
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vDistance = length(worldPosition.xz);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform vec3 uColor1;
    uniform vec3 uColor2;
    uniform float uFadeDistance;
    varying vec2 vUv;
    varying float vDistance;

    void main() {
      vec2 grid = abs(fract(vUv * 50.0 - 0.5) - 0.5) / fwidth(vUv * 50.0);
      float line = min(grid.x, grid.y);
      float gridPattern = 1.0 - min(line, 1.0);

      float pulse = sin(vUv.y * 30.0 - uTime * 3.0) * 0.5 + 0.5;
      vec3 color = mix(uColor1, uColor2, pulse);

      float fade = 1.0 - smoothstep(0.0, uFadeDistance, vDistance);
      float alpha = gridPattern * fade * 0.9;

      gl_FragColor = vec4(color, alpha);
    }
  `
};

// Advanced Water Shader Material
const waterShader = {
  uniforms: {
    uTime: { value: 0 },
    uColor1: { value: new THREE.Color('#006994') },
    uColor2: { value: new THREE.Color('#001a33') },
  },
  vertexShader: `
    uniform float uTime;
    varying vec2 vUv;
    varying float vElevation;

    void main() {
      vUv = uv;
      vec3 pos = position;

      float wave1 = sin(pos.x * 2.0 + uTime) * 0.3;
      float wave2 = sin(pos.y * 3.0 + uTime * 0.8) * 0.2;
      float wave3 = sin((pos.x + pos.y) * 1.5 + uTime * 1.2) * 0.15;

      pos.z += wave1 + wave2 + wave3;
      vElevation = pos.z;

      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform vec3 uColor1;
    uniform vec3 uColor2;
    varying vec2 vUv;
    varying float vElevation;

    void main() {
      float mixStrength = (vElevation + 0.5) * 0.5;
      vec3 color = mix(uColor2, uColor1, mixStrength);

      // Add specular highlights
      float specular = pow(max(0.0, sin(vUv.x * 20.0 + uTime * 2.0) * sin(vUv.y * 20.0 + uTime * 1.5)), 8.0);
      color += vec3(specular * 0.3);

      gl_FragColor = vec4(color, 0.85);
    }
  `
};

// ============================================================================
// MODEL PRELOADER
// ============================================================================

const preloadedModels = new Set<string>();

function preloadModel(path: string) {
  if (!preloadedModels.has(path) && path) {
    useGLTF.preload(path);
    preloadedModels.add(path);
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function lerpColor(color1: string, color2: string, t: number): string {
  const c1 = new THREE.Color(color1);
  const c2 = new THREE.Color(color2);
  const result = c1.clone().lerp(c2, t);
  return `#${result.getHexString()}`;
}

function formatValue(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

// Seeded random for deterministic results
function seededRandom(seed: number): () => number {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

// ============================================================================
// CAMERA CALCULATION - Pure function, deterministic
// ============================================================================

function calculateCameraState(
  towers: { position: [number, number, number]; height: number }[],
  currentIndex: number,
  progress: number,
  distance: number,
  angle: number
): { position: [number, number, number]; lookAt: [number, number, number] } {
  if (towers.length === 0) {
    return { position: [35, 18, -25], lookAt: [0, 10, 0] };
  }

  const currentTower = towers[Math.min(currentIndex, towers.length - 1)];
  const nextIndex = Math.min(currentIndex + 1, towers.length - 1);
  const nextTower = towers[nextIndex];

  const easedProgress = progress < 0.5
    ? 2 * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 2) / 2;

  const targetZ = THREE.MathUtils.lerp(currentTower.position[2], nextTower.position[2], easedProgress);
  const avgHeight = THREE.MathUtils.lerp(currentTower.height, nextTower.height, easedProgress);
  const angleRad = (angle * Math.PI) / 180;

  return {
    position: [
      Math.sin(angleRad) * distance,
      avgHeight + 15,
      targetZ + Math.cos(angleRad) * distance
    ],
    lookAt: [0, avgHeight + 6, targetZ]
  };
}

// ============================================================================
// 3D SCENE COMPONENTS - ENHANCED REALISTIC MATERIALS
// ============================================================================

function StarField() {
  return (
    <Stars
      radius={150}
      depth={100}
      count={3000}
      factor={6}
      saturation={0.2}
      fade
      speed={0}
    />
  );
}

function FloatingParticles() {
  const count = 50;
  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const random = seededRandom(12345);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (random() - 0.5) * 150;
      pos[i * 3 + 1] = random() * 80;
      pos[i * 3 + 2] = (random() - 0.5) * 250;
    }
    return pos;
  }, []);

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.5} color="#ffffff" transparent opacity={0.5} sizeAttenuation />
    </points>
  );
}

// Enhanced Tower with PBR materials and realistic properties
function Tower({ position, height, color, width = 3, depth = 3, opacity = 1, rank, name, value, subtitle, image, showLabel, isHighlighted, visible }: {
  position: [number, number, number];
  height: number;
  color: string;
  width?: number;
  depth?: number;
  opacity?: number;
  rank: number;
  name: string;
  value: string;
  subtitle?: string;
  image?: string;
  showLabel: boolean;
  isHighlighted: boolean;
  visible: boolean;
}) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [loaded, setLoaded] = useState(false);
  const loadedRef = useRef(false);
  const meshRef = useRef<THREE.Mesh>(null);

  useEffect(() => {
    if (!image) {
      setTexture(null);
      setLoaded(true);
      return;
    }

    const handle = delayRender('Loading tower texture: ' + image);
    let cancelled = false;

    const loader = new THREE.TextureLoader();
    loader.load(image, (tex) => {
      if (cancelled) return;
      tex.colorSpace = THREE.SRGBColorSpace;
      setTexture(tex);
      setLoaded(true);
      loadedRef.current = true;
      continueRender(handle);
    }, undefined, () => {
      if (cancelled) return;
      setTexture(null);
      setLoaded(true);
      loadedRef.current = true;
      continueRender(handle);
    });

    return () => {
      cancelled = true;
      if (!loadedRef.current) {
        cancelRender(handle);
      }
    };
  }, [image]);

  if (!loaded) return null;
  if (!visible) return null;

  // Calculate emissive intensity based on highlight state
  const emissiveIntensity = isHighlighted ? 0.5 : 0.15;
  const glowIntensity = isHighlighted ? 1.2 : 0.4;

  return (
    <group position={position}>
      {/* Ground shadow/reflection */}
      <mesh position={[0, 0.02, 0]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width + 2, depth + 2]} />
        <meshStandardMaterial color={color} transparent opacity={0.3 * opacity} />
      </mesh>

      {/* Main tower body with enhanced PBR material */}
      <Box args={[width, height, depth]} position={[0, height / 2, 0]} castShadow receiveShadow>
        <meshStandardMaterial
          color={color}
          metalness={0.7}
          roughness={0.15}
          envMapIntensity={2}
          transparent={opacity < 1}
          opacity={opacity}
          emissive={color}
          emissiveIntensity={emissiveIntensity}
        />
      </Box>

      {/* Clean glowing top cap */}
      <Box args={[width + 0.15, 0.25, depth + 0.15]} position={[0, height + 0.12, 0]}>
        <meshStandardMaterial
          color="#ffffff"
          metalness={0.9}
          roughness={0.1}
          emissive={color}
          emissiveIntensity={glowIntensity}
          transparent={opacity < 1}
          opacity={opacity}
        />
      </Box>

      {/* Edge glow effect */}
      <Box args={[width + 0.1, height - 0.5, depth + 0.1]} position={[0, height / 2, 0]}>
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.1 * opacity}
          side={THREE.BackSide}
        />
      </Box>

{image && texture && (
  <Billboard position={[0, height + 10, 0]} follow={true}>
    {/* Clean frame border */}
    <mesh position={[0, 0, -0.05]} renderOrder={995}>
      <planeGeometry args={[3.4, 3.4]} />
      <meshBasicMaterial color="#1a1a2e" />
    </mesh>
    {/* 3D backing for depth */}
    <mesh position={[0, 0, -0.15]} renderOrder={996}>
      <boxGeometry args={[3.2, 3.2, 0.2]} />
      <meshStandardMaterial color={color} metalness={0.8} roughness={0.15} emissive={color} emissiveIntensity={0.2} />
    </mesh>
    {/* White border */}
    <mesh position={[0, 0, 0.001]} renderOrder={997}>
      <planeGeometry args={[3.15, 3.15]} />
      <meshBasicMaterial color="#ffffff" />
    </mesh>
    {/* Inner dark border */}
    <mesh position={[0, 0, 0.002]} renderOrder={998}>
      <planeGeometry args={[3.0, 3.0]} />
      <meshBasicMaterial color="#0f0f1a" />
    </mesh>
    {/* Main image - centered and crisp */}
    <mesh position={[0, 0, 0.01]} renderOrder={999}>
      <planeGeometry args={[2.85, 2.85]} />
      <meshBasicMaterial map={texture} transparent opacity={opacity} depthTest={false} depthWrite={false} />
    </mesh>
    {/* Subtle highlight */}
    <mesh position={[-0.5, 0.5, 0.02]} renderOrder={1000}>
      <planeGeometry args={[1.0, 1.0]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={0.08 * opacity} depthTest={false} depthWrite={false} />
    </mesh>
  </Billboard>
)}
      
     {showLabel && (
  <Billboard position={[0, height + (image && texture ? 4.5 : 4), 0]} follow={true}>
  <group position={[-0.5, 1.2, 0]}>
    <Text position={[-1.8, 0, 0]} fontSize={0.75} color="#FFD700" anchorX="right" anchorY="middle" fontWeight="bold" outlineWidth={0.06} outlineColor="#000000">#{rank}</Text>
    <Text position={[-1.2, 0, 0]} fontSize={0.7} color="#FFFFFF" anchorX="left" anchorY="middle" fontWeight="bold" outlineWidth={0.06} outlineColor="#000000" maxWidth={20} textAlign="left">{name}</Text>
  </group>
  <Text position={[0, -0.2, 0]} fontSize={0.7} color="#4ADE80" anchorX="center" anchorY="middle" fontWeight="bold" outlineWidth={0.05} outlineColor="#000000">{value}</Text>
  {subtitle && (
    <Text position={[0, -1.0, 0]} fontSize={0.4} color="#94A3B8" anchorX="center" anchorY="middle" outlineWidth={0.05} outlineColor="#000000" maxWidth={16}>{subtitle}</Text>
  )}
</Billboard>
      )}
    </group>
  );
}

// Enhanced Ground with reflections
function Ground({ color }: { color: string }) {
  return (
    <group>
      {/* Reflective ground plane */}
      <Plane args={[500, 500]} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
        <MeshReflectorMaterial
          blur={[300, 100]}
          resolution={1024}
          mixBlur={1}
          mixStrength={50}
          roughness={0.8}
          depthScale={1.2}
          minDepthThreshold={0.4}
          maxDepthThreshold={1.4}
          color={color}
          metalness={0.5}
        />
      </Plane>
      {/* Grid overlay */}
      <gridHelper args={[500, 100, '#2a2a5a', '#1a1a3a']} position={[0, 0.01, 0]} />
    </group>
  );
}

// ============================================================================
// BACKGROUND ENVIRONMENT PRESETS - ADVANCED REALISTIC
// ============================================================================

function BackgroundEnvironment({ preset, totalLength, frame = 0 }: { preset: string; totalLength: number; frame?: number }) {
  const envLength = Math.max(totalLength, 100);

  switch (preset) {
    case 'none':
      return null;

    case 'cyber-grid':
      return <CyberGridEnvironment totalLength={envLength} frame={frame} />;
    case 'mountain-range':
      return <MountainRangeEnvironment totalLength={envLength} />;
    case 'ocean-waves':
      return <OceanWavesEnvironment totalLength={envLength} frame={frame} />;
    case 'forest-trees':
      return <ForestTreesEnvironment totalLength={envLength} />;
    case 'city-skyline':
      return <CitySkylineEnvironment totalLength={envLength} />;
    case 'abstract-waves':
      return <AbstractWavesEnvironment totalLength={envLength} frame={frame} />;
    case 'space-station':
      return <SpaceStationEnvironment totalLength={envLength} />;
    case 'aurora-borealis':
      return <AuroraBorealisEnvironment totalLength={envLength} frame={frame} />;
    case 'volcanic-inferno':
      return <VolcanicInfernoEnvironment totalLength={envLength} frame={frame} />;
    case 'crystal-caves':
      return <CrystalCavesEnvironment totalLength={envLength} />;
    case 'desert-dunes':
      return <DesertDunesEnvironment totalLength={envLength} />;
    case 'neon-tokyo':
      return <NeonTokyoEnvironment totalLength={envLength} frame={frame} />;
    case 'floating-islands':
      return <FloatingIslandsEnvironment totalLength={envLength} />;
    case 'deep-ocean':
      return <DeepOceanEnvironment totalLength={envLength} frame={frame} />;
    case 'galaxy-nebula':
      return <GalaxyNebulaEnvironment totalLength={envLength} />;
    case 'matrix-rain':
      return <MatrixRainEnvironment totalLength={envLength} frame={frame} />;
    case 'ice-glacier':
      return <IceGlacierEnvironment totalLength={envLength} />;
    case 'steampunk-gears':
      return <SteampunkGearsEnvironment totalLength={envLength} frame={frame} />;
    case 'alien-planet':
      return <AlienPlanetEnvironment totalLength={envLength} frame={frame} />;
    case 'tron-grid':
      return <TronGridEnvironment totalLength={envLength} frame={frame} />;
    // Immersive Environments
    case 'football-stadium':
      return <FootballStadiumEnvironment totalLength={envLength} />;
    case 'race-track':
      return <RaceTrackEnvironment totalLength={envLength} />;
    case 'concert-stage':
      return <ConcertStageEnvironment totalLength={envLength} frame={frame} />;
    case 'castle-grounds':
      return <CastleGroundsEnvironment totalLength={envLength} />;
    case 'airport-runway':
      return <AirportRunwayEnvironment totalLength={envLength} />;
    case 'theme-park':
      return <ThemeParkEnvironment totalLength={envLength} />;
    case 'ancient-ruins':
      return <AncientRuinsEnvironment totalLength={envLength} />;
    case 'zen-garden':
      return <ZenGardenEnvironment totalLength={envLength} />;
    case 'ski-resort':
      return <SkiResortEnvironment totalLength={envLength} />;
    // New Advanced Immersive Environments
    case 'underwater-kingdom':
      return <UnderwaterKingdomEnvironment totalLength={envLength} frame={frame} />;
    case 'cyberpunk-city':
      return <CyberpunkCityEnvironment totalLength={envLength} frame={frame} />;
    case 'medieval-arena':
      return <MedievalArenaEnvironment totalLength={envLength} />;
    case 'space-colony':
      return <SpaceColonyEnvironment totalLength={envLength} />;
    case 'tropical-beach':
      return <TropicalBeachEnvironment totalLength={envLength} />;
    default:
      return <CyberGridEnvironment totalLength={envLength} frame={frame} />;
  }
}

// ============================================================================
// ADVANCED ENVIRONMENT PRESETS WITH SHADERS AND EFFECTS
// ============================================================================

function CyberGridEnvironment({ totalLength, frame = 0 }: { totalLength: number; frame?: number }) {
  const gridLength = Math.max(totalLength + 100, 200);
  const lineCount = Math.ceil(gridLength / 12);
  const gridRef = useRef<THREE.Mesh>(null);
  const CORRIDOR_WIDTH = 18; // Clear space in middle for towers

  // Animate grid
  useFrame(() => {
    if (gridRef.current) {
      const material = gridRef.current.material as THREE.ShaderMaterial;
      if (material.uniforms) {
        material.uniforms.uTime.value = frame * 0.05;
      }
    }
  });

  return (
    <group>
      {/* Glowing grid floor - left side */}
      <mesh ref={gridRef} rotation={[-Math.PI / 2, 0, 0]} position={[-35 - gridLength / 4, 0.05, totalLength / 2]}>
        <planeGeometry args={[gridLength / 2, gridLength]} />
        <shaderMaterial
          attach="material"
          args={[glowGridShader]}
          transparent
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Glowing grid floor - right side */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[35 + gridLength / 4, 0.05, totalLength / 2]}>
        <planeGeometry args={[gridLength / 2, gridLength]} />
        <shaderMaterial
          attach="material"
          args={[glowGridShader]}
          transparent
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Grid helpers - left and right only, with gap in middle */}
      <gridHelper args={[gridLength / 2 - CORRIDOR_WIDTH, Math.floor(gridLength / 8), '#00ffff', '#ff00ff']} position={[-35 - gridLength / 4 + (gridLength / 4 - CORRIDOR_WIDTH / 2), 0.1, totalLength / 2]} />
      <gridHelper args={[gridLength / 2 - CORRIDOR_WIDTH, Math.floor(gridLength / 8), '#00ffff', '#ff00ff']} position={[35 + gridLength / 4 - (gridLength / 4 - CORRIDOR_WIDTH / 2), 0.1, totalLength / 2]} />

      {/* Glowing vertical beams - left side only */}
      {[...Array(lineCount)].map((_, i) => (
        <mesh key={`left-${i}`} position={[-55 - (i % 3) * 30, 0.05, -40 + i * 12]}>
          <boxGeometry args={[gridLength, 0.15, 0.3]} />
          <meshBasicMaterial color="#00ffff" transparent opacity={0.7} />
        </mesh>
      ))}

      {/* Glowing vertical beams - right side only */}
      {[...Array(lineCount)].map((_, i) => (
        <mesh key={`right-${i}`} position={[55 + (i % 3) * 30, 0.05, -40 + i * 12]}>
          <boxGeometry args={[gridLength, 0.15, 0.3]} />
          <meshBasicMaterial color="#ff00ff" transparent opacity={0.7} />
        </mesh>
      ))}

      {/* Floating neon pillars - left side */}
      {[...Array(6)].map((_, i) => (
        <Float key={`left-pillar-${i}`} speed={2} rotationIntensity={0.2} floatIntensity={0.5}>
          <mesh position={[-45 - (i % 3) * 15, 8 + (i % 3) * 4, -30 + i * (totalLength / 5)]}>
            <boxGeometry args={[1, 15 + (i % 5) * 3, 1]} />
            <meshStandardMaterial color="#00ffff" emissive="#00ffff" emissiveIntensity={0.8} />
          </mesh>
        </Float>
      ))}

      {/* Floating neon pillars - right side */}
      {[...Array(6)].map((_, i) => (
        <Float key={`right-pillar-${i}`} speed={2} rotationIntensity={0.2} floatIntensity={0.5}>
          <mesh position={[45 + (i % 3) * 15, 8 + (i % 3) * 4, -30 + i * (totalLength / 5)]}>
            <boxGeometry args={[1, 15 + (i % 5) * 3, 1]} />
            <meshStandardMaterial color="#ff00ff" emissive="#ff00ff" emissiveIntensity={0.8} />
          </mesh>
        </Float>
      ))}
    </group>
  );
}

function MountainRangeEnvironment({ totalLength }: { totalLength: number }) {
  const mountainCount = Math.max(Math.ceil(totalLength / 18), 15);
  const mountains = useMemo(() => {
    const random = seededRandom(42);
    return [...Array(mountainCount)].map((_, i) => ({
      x: -180 + i * 24,
      height: 25 + random() * 45,
      width: 18 + random() * 22,
      depth: 18 + random() * 15,
    }));
  }, [mountainCount]);

  return (
    <group position={[0, 0, -totalLength * 0.35]}>
      {mountains.map((m, i) => (
        <group key={i} position={[m.x, 0, i * (totalLength / mountainCount)]}>
          {/* Mountain body */}
          <mesh position={[0, m.height / 2, 0]} castShadow>
            <coneGeometry args={[m.width, m.height, 5]} />
            <meshStandardMaterial color="#1a1a2e" roughness={0.9} metalness={0.1} flatShading />
          </mesh>
          {/* Snow cap */}
          {m.height > 40 && (
            <mesh position={[0, m.height - 8, 0]} castShadow>
              <coneGeometry args={[m.width * 0.35, 12, 5]} />
              <meshStandardMaterial color="#ffffff" roughness={0.7} metalness={0.1} />
            </mesh>
          )}
        </group>
      ))}
      {/* Atmospheric fog layer */}
      <Cloud position={[0, 15, totalLength / 2]} opacity={0.3} speed={0.2} width={200} depth={30} segments={20} />
    </group>
  );
}

function OceanWavesEnvironment({ totalLength, frame = 0 }: { totalLength: number; frame?: number }) {
  const waveCount = Math.max(Math.ceil(totalLength / 12), 25);
  const waterRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (waterRef.current) {
      const material = waterRef.current.material as THREE.ShaderMaterial;
      if (material.uniforms) {
        material.uniforms.uTime.value = frame * 0.03;
      }
    }
  });

  return (
    <group>
      {/* Animated water surface with custom shader */}
      <mesh ref={waterRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.5, totalLength / 2]}>
        <planeGeometry args={[350, totalLength + 120, 80, 80]} />
        <shaderMaterial
          attach="material"
          args={[waterShader]}
          transparent
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Wave particles */}
      <Sparkles count={200} scale={12} size={2} speed={0.3} opacity={0.4} color="#00bfff" position={[0, 2, totalLength / 2]} />

      {/* Underwater caustics effect */}
      <pointLight position={[0, -5, totalLength / 2]} intensity={1.5} color="#00bfff" distance={80} />
    </group>
  );
}

function ForestTreesEnvironment({ totalLength }: { totalLength: number }) {
  const treeCount = Math.max(Math.ceil(totalLength / 4), 40);
  const CORRIDOR_WIDTH = 16; // Clear space in middle for towers
  const trees = useMemo(() => {
    const random = seededRandom(123);
    return [...Array(treeCount)].map((_, i) => {
      // Generate x position, avoiding the center corridor
      let x = (random() - 0.5) * 100;
      // If x is in the corridor range, push it to the side
      if (Math.abs(x) < CORRIDOR_WIDTH / 2) {
        x = x >= 0 ? CORRIDOR_WIDTH / 2 + random() * 40 : -CORRIDOR_WIDTH / 2 - random() * 40;
      }
      return {
        x,
        z: i * (totalLength / treeCount),
        height: 10 + random() * 18,
        trunkHeight: 3 + random() * 4,
      };
    });
  }, [treeCount, totalLength]);

  return (
    <group>
      {trees.map((tree, i) => (
        <group key={i} position={[tree.x, 0, tree.z]}>
          {/* Trunk with bark texture simulation */}
          <mesh position={[0, tree.trunkHeight / 2, 0]} castShadow>
            <cylinderGeometry args={[0.6, 1.0, tree.trunkHeight, 8]} />
            <meshStandardMaterial color="#3d2817" roughness={0.95} />
          </mesh>
          {/* Multiple foliage layers for realism */}
          <mesh position={[0, tree.trunkHeight + tree.height * 0.3, 0]} castShadow>
            <coneGeometry args={[4, tree.height * 0.5, 8]} />
            <meshStandardMaterial color="#1a4d1a" roughness={0.85} flatShading />
          </mesh>
          <mesh position={[0, tree.trunkHeight + tree.height * 0.55, 0]} castShadow>
            <coneGeometry args={[3, tree.height * 0.35, 8]} />
            <meshStandardMaterial color="#225522" roughness={0.85} flatShading />
          </mesh>
        </group>
      ))}
      {/* Ground cover - split with gap in middle */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-35, -0.1, totalLength / 2]}>
        <planeGeometry args={[50, totalLength + 40]} />
        <meshStandardMaterial color="#1a3d1a" roughness={0.95} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[35, -0.1, totalLength / 2]}>
        <planeGeometry args={[50, totalLength + 40]} />
        <meshStandardMaterial color="#1a3d1a" roughness={0.95} />
      </mesh>
    </group>
  );
}

function CitySkylineEnvironment({ totalLength }: { totalLength: number }) {
  const buildingCount = Math.max(Math.ceil(totalLength / 6), 30);
  const CORRIDOR_WIDTH = 14;
  const buildings = useMemo(() => {
    const random = seededRandom(456);
    return [...Array(buildingCount)].map((_, i) => {
      let x = (random() - 0.5) * 120;
      if (Math.abs(x) < CORRIDOR_WIDTH / 2) {
        x = x >= 0 ? CORRIDOR_WIDTH / 2 + random() * 45 : -CORRIDOR_WIDTH / 2 - random() * 45;
      }
      return {
        x,
        z: i * (totalLength / buildingCount),
        height: 18 + random() * 55,
        width: 6 + random() * 12,
        depth: 6 + random() * 12,
      };
    });
  }, [buildingCount, totalLength]);

  return (
    <group>
      {buildings.map((b, i) => (
        <group key={i} position={[b.x, 0, b.z]}>
          <mesh position={[0, b.height / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[b.width, b.height, b.depth]} />
            <meshStandardMaterial color="#1a1a2e" metalness={0.6} roughness={0.4} />
          </mesh>
          {buildings.filter((_, idx) => idx === i).slice(0, 1).map((b) =>
            [...Array(Math.floor(b.height / 4))].map((_, j) => (
              <mesh key={`light-${i}-${j}`} position={[b.width / 2 + 0.05, 4 + j * 4, 0]}>
                <planeGeometry args={[b.width * 0.7, 2.5]} />
                <meshBasicMaterial color={j % 3 === 0 ? '#ffff99' : '#ffcc66'} transparent opacity={0.85} />
              </mesh>
            ))
          )}
          <mesh position={[0, b.height + 1, 0]}>
            <boxGeometry args={[b.width * 0.3, 2, b.depth * 0.3]} />
            <meshStandardMaterial color="#2a2a4e" metalness={0.7} roughness={0.3} />
          </mesh>
        </group>
      ))}
      <Sparkles count={50} scale={8} size={1.5} speed={0.1} opacity={0.3} color="#ffff99" position={[-35, 1, totalLength / 2]} />
      <Sparkles count={50} scale={8} size={1.5} speed={0.1} opacity={0.3} color="#ffff99" position={[35, 1, totalLength / 2]} />
    </group>
  );
}

function AbstractWavesEnvironment({ totalLength, frame = 0 }: { totalLength: number; frame?: number }) {
  const waveCount = Math.max(Math.ceil(totalLength / 20), 10);
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.z = Math.sin(frame * 0.02) * 0.1;
    }
  });

  return (
    <group ref={groupRef} position={[0, -8, totalLength / 4]}>
      {[...Array(waveCount)].map((_, i) => (
        <Float key={i} speed={1 + i * 0.2} rotationIntensity={0.1} floatIntensity={0.3}>
          <mesh position={[0, i * 3, i * -(totalLength / waveCount)]} rotation={[0, 0, i * 0.15]}>
            <torusGeometry args={[45 - i * 4, 0.6 + i * 0.1, 12, 64, Math.PI * 2]} />
            <meshStandardMaterial
              color={`hsl(${200 + i * 25}, 75%, 55%)`}
              metalness={0.7}
              roughness={0.2}
              transparent
              opacity={0.7 - i * 0.05}
              emissive={`hsl(${200 + i * 25}, 75%, 55%)`}
              emissiveIntensity={0.3}
            />
          </mesh>
        </Float>
      ))}
    </group>
  );
}

function SpaceStationEnvironment({ totalLength }: { totalLength: number }) {
  const stationCount = Math.max(Math.ceil(totalLength / 120), 2);

  return (
    <group position={[0, 25, totalLength / 2]}>
      {[...Array(stationCount)].map((_, s) => (
        <group key={s} position={[0, 0, s * 120 - totalLength / 2]}>
          {/* Station ring */}
          <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
            <torusGeometry args={[35, 4, 12, 48]} />
            <meshStandardMaterial color="#555555" metalness={0.9} roughness={0.15} />
          </mesh>
          {/* Central hub */}
          <mesh castShadow>
            <sphereGeometry args={[10, 24, 24]} />
            <meshStandardMaterial color="#666666" metalness={0.8} roughness={0.2} />
          </mesh>
          {/* Solar panels with realistic material */}
          <mesh position={[-45, 0, 0]} rotation={[0, 0, Math.PI / 4]}>
            <boxGeometry args={[25, 0.3, 10]} />
            <meshStandardMaterial color="#1a237e" metalness={0.4} roughness={0.5} />
          </mesh>
          <mesh position={[45, 0, 0]} rotation={[0, 0, -Math.PI / 4]}>
            <boxGeometry args={[25, 0.3, 10]} />
            <meshStandardMaterial color="#1a237e" metalness={0.4} roughness={0.5} />
          </mesh>
          {/* Antenna */}
          <mesh position={[0, 15, 0]}>
            <cylinderGeometry args={[0.3, 0.3, 15, 8]} />
            <meshStandardMaterial color="#888888" metalness={0.9} roughness={0.1} />
          </mesh>
          {/* Lights */}
          <pointLight position={[0, 0, 0]} intensity={2} color="#ffffff" distance={30} />
        </group>
      ))}
    </group>
  );
}

function AuroraBorealisEnvironment({ totalLength, frame = 0 }: { totalLength: number; frame?: number }) {
  const auroraCount = Math.max(Math.ceil(totalLength / 25), 8);
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.children.forEach((child, i) => {
        if (child instanceof THREE.Mesh) {
          child.position.y = 35 + Math.sin(frame * 0.02 + i) * 5;
          const material = child.material as THREE.MeshBasicMaterial;
          if (material.opacity !== undefined) {
            material.opacity = 0.25 + Math.sin(frame * 0.03 + i * 0.5) * 0.1;
          }
        }
      });
    }
  });

  return (
    <group ref={groupRef} position={[0, 35, totalLength / 2 - 40]}>
      {[...Array(auroraCount)].map((_, i) => (
        <mesh key={i} position={[-50 + (i % 5) * 25, Math.sin(i) * 12, -totalLength / 2 + i * 30]} rotation={[0.25, 0, 0.1 * i]}>
          <planeGeometry args={[18, 60]} />
          <meshBasicMaterial
            color={`hsl(${120 + i * 35}, 85%, 55%)`}
            transparent
            opacity={0.3}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
}

function VolcanicInfernoEnvironment({ totalLength, frame = 0 }: { totalLength: number; frame?: number }) {
  const volcanoCount = Math.max(Math.ceil(totalLength / 120), 1);
  const lavaRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (lavaRef.current) {
      lavaRef.current.scale.setScalar(1 + Math.sin(frame * 0.1) * 0.05);
    }
  });

  return (
    <group position={[0, 0, totalLength / 2]}>
      {[...Array(volcanoCount)].map((_, v) => (
        <group key={v} position={[0, 0, -totalLength / 2 + v * 120 + 60]}>
          {/* Volcano body */}
          <mesh position={[0, 18, -90]} castShadow>
            <coneGeometry args={[50, 70, 10]} />
            <meshStandardMaterial color="#1a0a0a" roughness={0.95} />
          </mesh>
          {/* Lava pool */}
          <mesh ref={lavaRef} position={[0, 55, -90]}>
            <sphereGeometry args={[10, 16, 16]} />
            <meshBasicMaterial color="#ff4400" />
          </mesh>
          {/* Lava streams */}
          {[...Array(8)].map((_, i) => (
            <mesh key={i} position={[-18 + i * 5, 35 - i * 6, -85 + i * 2]} rotation={[0.35, 0, 0.25]}>
              <boxGeometry args={[2.5, 25, 1.2]} />
              <meshBasicMaterial color={i % 2 === 0 ? '#ff4400' : '#ff6600'} transparent opacity={0.8} />
            </mesh>
          ))}
          {/* Embers */}
          <Sparkles count={150} scale={15} size={2.5} speed={0.5} opacity={0.7} color="#ff6600" position={[0, 40, -90]} />
          <pointLight position={[0, 58, -90]} intensity={3} color="#ff4400" distance={120} />
          <pointLight position={[0, 30, -70]} intensity={1.5} color="#ff2200" distance={80} />
        </group>
      ))}
    </group>
  );
}

function CrystalCavesEnvironment({ totalLength }: { totalLength: number }) {
  const crystalCount = Math.max(Math.ceil(totalLength / 6), 25);
  const crystals = useMemo(() => {
    const random = seededRandom(789);
    return [...Array(crystalCount)].map((_, i) => ({
      x: (random() - 0.5) * 80,
      z: i * (totalLength / crystalCount),
      height: 6 + random() * 22,
      color: `hsl(${190 + random() * 80}, 70%, 60%)`,
      rotation: random() * 0.5,
    }));
  }, [crystalCount, totalLength]);

  return (
    <group position={[0, 0, totalLength / 2]}>
      {crystals.map((c, i) => (
        <group key={i} position={[c.x, 0, c.z - totalLength / 2]} rotation={[0, c.rotation, 0]}>
          {/* Crystal with emissive glow */}
          <mesh position={[0, c.height / 2, 0]} castShadow>
            <coneGeometry args={[1.8, c.height, 6]} />
            <meshStandardMaterial
              color={c.color}
              transparent
              opacity={0.75}
              metalness={0.4}
              roughness={0.1}
              emissive={c.color}
              emissiveIntensity={0.5}
            />
          </mesh>
          {/* Point light for each crystal cluster */}
          {i % 5 === 0 && (
            <pointLight position={[0, c.height / 2, 0]} intensity={0.8} color={c.color} distance={20} />
          )}
        </group>
      ))}
      {/* Cave ambient lighting */}
      <pointLight position={[0, 30, totalLength / 2]} intensity={0.5} color="#4488ff" distance={100} />
    </group>
  );
}

function DesertDunesEnvironment({ totalLength }: { totalLength: number }) {
  const duneCount = Math.max(Math.ceil(totalLength / 15), 10);
  const cactusCount = Math.max(Math.ceil(totalLength / 25), 6);
  const CORRIDOR_WIDTH = 16;

  return (
    <group position={[0, 0, totalLength / 2]}>
      {/* Sand dunes - left side */}
      {[...Array(duneCount)].map((_, i) => (
        <mesh key={`left-${i}`} position={[-60 - (i % 3) * 35, 0, -totalLength / 2 + i * 18]} rotation={[0, i * 0.35, 0]}>
          <sphereGeometry args={[22 + i * 2.5, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#c2a060" roughness={0.92} />
        </mesh>
      ))}
      {/* Sand dunes - right side */}
      {[...Array(duneCount)].map((_, i) => (
        <mesh key={`right-${i}`} position={[60 + (i % 3) * 35, 0, -totalLength / 2 + i * 18]} rotation={[0, i * 0.35, 0]}>
          <sphereGeometry args={[22 + i * 2.5, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#c2a060" roughness={0.92} />
        </mesh>
      ))}
      {/* Cacti - left side */}
      {[...Array(cactusCount)].map((_, i) => (
        <group key={`cactus-left-${i}`} position={[-50 - (i % 3) * 25, 0, -totalLength / 2 + i * 28]}>
          <mesh position={[0, 5.5, 0]} castShadow>
            <cylinderGeometry args={[0.9, 1.2, 11, 10]} />
            <meshStandardMaterial color="#2d5a27" roughness={0.85} />
          </mesh>
          <mesh position={[1.8, 7, 0]} rotation={[0, 0, Math.PI / 4]} castShadow>
            <cylinderGeometry args={[0.55, 0.65, 6, 8]} />
            <meshStandardMaterial color="#2d5a27" roughness={0.85} />
          </mesh>
          <mesh position={[-1.5, 4.5, 0]} rotation={[0, 0, -Math.PI / 3.5]} castShadow>
            <cylinderGeometry args={[0.5, 0.6, 4, 8]} />
            <meshStandardMaterial color="#2d5a27" roughness={0.85} />
          </mesh>
        </group>
      ))}
      {/* Cacti - right side */}
      {[...Array(cactusCount)].map((_, i) => (
        <group key={`cactus-right-${i}`} position={[50 + (i % 3) * 25, 0, -totalLength / 2 + i * 28]}>
          <mesh position={[0, 5.5, 0]} castShadow>
            <cylinderGeometry args={[0.9, 1.2, 11, 10]} />
            <meshStandardMaterial color="#2d5a27" roughness={0.85} />
          </mesh>
          <mesh position={[1.8, 7, 0]} rotation={[0, 0, Math.PI / 4]} castShadow>
            <cylinderGeometry args={[0.55, 0.65, 6, 8]} />
            <meshStandardMaterial color="#2d5a27" roughness={0.85} />
          </mesh>
          <mesh position={[-1.5, 4.5, 0]} rotation={[0, 0, -Math.PI / 3.5]} castShadow>
            <cylinderGeometry args={[0.5, 0.6, 4, 8]} />
            <meshStandardMaterial color="#2d5a27" roughness={0.85} />
          </mesh>
        </group>
      ))}
      {/* Heat shimmer effect - sides only */}
      <Sparkles count={25} scale={20} size={1} speed={0.2} opacity={0.15} color="#ffddaa" position={[-40, 8, totalLength / 2]} />
      <Sparkles count={25} scale={20} size={1} speed={0.2} opacity={0.15} color="#ffddaa" position={[40, 8, totalLength / 2]} />
    </group>
  );
}

function NeonTokyoEnvironment({ totalLength, frame = 0 }: { totalLength: number; frame?: number }) {
  const buildingCount = Math.max(Math.ceil(totalLength / 10), 18);
  const CORRIDOR_WIDTH = 14;
  const groupRef = useRef<THREE.Group>(null);

  return (
    <group ref={groupRef} position={[0, 0, totalLength / 2]}>
      {/* Neon buildings - left side */}
      {[...Array(buildingCount)].map((_, i) => {
        const xPos = -70 - Math.floor(i / 2) * 18;
        if (Math.abs(xPos) < CORRIDOR_WIDTH / 2) return null;
        return (
          <group key={`left-${i}`} position={[xPos, 0, -totalLength / 2 + i * 10]}>
            <mesh position={[0, 22 + (i % 6) * 6, 0]} castShadow>
              <boxGeometry args={[10, 44 + (i % 7) * 9, 10]} />
              <meshStandardMaterial color="#0a0a18" metalness={0.6} roughness={0.4} />
            </mesh>
            <mesh position={[5.1, 16 + (i % 4) * 6, 0]}>
              <planeGeometry args={[1.2, 10]} />
              <meshBasicMaterial color={`hsl(${290 + i * 25}, 100%, 55%)`} />
            </mesh>
            <mesh position={[5.05, 0, 0]}>
              <planeGeometry args={[0.3, 40]} />
              <meshBasicMaterial color={i % 2 === 0 ? '#ff00ff' : '#00ffff'} />
            </mesh>
          </group>
        );
      })}
      {/* Neon buildings - right side */}
      {[...Array(buildingCount)].map((_, i) => {
        const xPos = 70 + Math.floor(i / 2) * 18;
        return (
          <group key={`right-${i}`} position={[xPos, 0, -totalLength / 2 + i * 10]}>
            <mesh position={[0, 22 + (i % 6) * 6, 0]} castShadow>
              <boxGeometry args={[10, 44 + (i % 7) * 9, 10]} />
              <meshStandardMaterial color="#0a0a18" metalness={0.6} roughness={0.4} />
            </mesh>
            <mesh position={[-5.1, 16 + (i % 4) * 6, 0]} rotation={[0, Math.PI, 0]}>
              <planeGeometry args={[1.2, 10]} />
              <meshBasicMaterial color={`hsl(${290 + i * 25}, 100%, 55%)`} />
            </mesh>
            <mesh position={[-5.05, 0, 0]}>
              <planeGeometry args={[0.3, 40]} />
              <meshBasicMaterial color={i % 2 === 0 ? '#00ffff' : '#ff00ff'} />
            </mesh>
          </group>
        );
      })}
      {/* Street neon strips - left and right */}
      <mesh position={[-45, 0.15, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[60, totalLength]} />
        <meshBasicMaterial color="#ff00ff" transparent opacity={0.9} />
      </mesh>
      <mesh position={[45, 0.15, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[60, totalLength]} />
        <meshBasicMaterial color="#00ffff" transparent opacity={0.9} />
      </mesh>
      {/* Rain effect - centered but doesn't block view */}
      <Sparkles count={150} scale={10} size={1} speed={0.8} opacity={0.2} color="#ffffff" position={[0, 20, totalLength / 2]} />
    </group>
  );
}

function FloatingIslandsEnvironment({ totalLength }: { totalLength: number }) {
  const islandCount = Math.max(Math.ceil(totalLength / 20), 8);
  const islands = useMemo(() => {
    const random = seededRandom(1111);
    return [...Array(islandCount)].map((_, i) => ({
      x: (random() - 0.5) * 80,
      y: 12 + random() * 35,
      z: i * (totalLength / islandCount),
      size: 10 + random() * 14,
      rotation: random() * Math.PI,
    }));
  }, [islandCount, totalLength]);

  return (
    <group position={[0, 0, totalLength / 2]}>
      {islands.map((island, i) => (
        <Float key={i} speed={0.8 + i * 0.1} rotationIntensity={0.15} floatIntensity={0.4}>
          <group position={[island.x, island.y, island.z - totalLength / 2]} rotation={[0, island.rotation, 0]}>
            {/* Island base rock */}
            <mesh castShadow receiveShadow>
              <sphereGeometry args={[island.size, 20, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
              <meshStandardMaterial color="#3d2817" roughness={0.92} />
            </mesh>
            {/* Grass top */}
            <mesh position={[0, 1.2, 0]} castShadow>
              <cylinderGeometry args={[island.size * 0.92, island.size * 0.98, 2.5, 20]} />
              <meshStandardMaterial color="#2d5a27" roughness={0.85} />
            </mesh>
            {/* Trees */}
            <mesh position={[0, 6, 0]} castShadow>
              <coneGeometry args={[3.5, 10, 8]} />
              <meshStandardMaterial color="#1a4d1a" flatShading roughness={0.8} />
            </mesh>
            <mesh position={[0, 12, 0]} castShadow>
              <coneGeometry args={[2.5, 7, 8]} />
              <meshStandardMaterial color="#225522" flatShading roughness={0.8} />
            </mesh>
            {/* Waterfall effect */}
            {i % 2 === 0 && (
              <>
                <mesh position={[island.size * 0.7, -2, 0]}>
                  <boxGeometry args={[1, 8, 0.5]} />
                  <meshBasicMaterial color="#4488ff" transparent opacity={0.7} />
                </mesh>
                <pointLight position={[island.size * 0.7, -2, 0]} intensity={0.6} color="#4488ff" distance={15} />
              </>
            )}
          </group>
        </Float>
      ))}
    </group>
  );
}

function DeepOceanEnvironment({ totalLength, frame = 0 }: { totalLength: number; frame?: number }) {
  const coralCount = Math.max(Math.ceil(totalLength / 8), 20);
  const seaweedCount = Math.max(Math.ceil(totalLength / 12), 12);
  const CORRIDOR_WIDTH = 14;

  return (
    <group position={[0, 0, totalLength / 2]}>
      {/* Ocean floor - left and right only */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-80, -12, 0]} receiveShadow>
        <planeGeometry args={[160, totalLength + 100]} />
        <meshStandardMaterial color="#001a33" roughness={0.95} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[80, -12, 0]} receiveShadow>
        <planeGeometry args={[160, totalLength + 100]} />
        <meshStandardMaterial color="#001a33" roughness={0.95} />
      </mesh>

      {/* Coral structures - left side */}
      {[...Array(coralCount)].map((_, i) => {
        const x = -70 - (i % 4) * 35;
        if (Math.abs(x) < CORRIDOR_WIDTH / 2) return null;
        return (
          <group key={`coral-left-${i}`} position={[x, 0, -totalLength / 2 + i * 8]}>
            <mesh rotation={[0, i * 0.6, 0]} castShadow>
              <cylinderGeometry args={[0.6, 2.5, 10, 8]} />
              <meshStandardMaterial color={`hsl(${330 + i * 12}, 75%, 52%)`} roughness={0.7} />
            </mesh>
            <mesh position={[0.5, 4, 0.3]} rotation={[0.3, 0.2, 0.4]} castShadow>
              <cylinderGeometry args={[0.3, 0.8, 5, 6]} />
              <meshStandardMaterial color={`hsl(${340 + i * 10}, 70%, 55%)`} roughness={0.7} />
            </mesh>
          </group>
        );
      })}
      {/* Coral structures - right side */}
      {[...Array(coralCount)].map((_, i) => {
        const x = 70 + (i % 4) * 35;
        return (
          <group key={`coral-right-${i}`} position={[x, 0, -totalLength / 2 + i * 8]}>
            <mesh rotation={[0, i * 0.6, 0]} castShadow>
              <cylinderGeometry args={[0.6, 2.5, 10, 8]} />
              <meshStandardMaterial color={`hsl(${330 + i * 12}, 75%, 52%)`} roughness={0.7} />
            </mesh>
            <mesh position={[0.5, 4, 0.3]} rotation={[0.3, 0.2, 0.4]} castShadow>
              <cylinderGeometry args={[0.3, 0.8, 5, 6]} />
              <meshStandardMaterial color={`hsl(${340 + i * 10}, 70%, 55%)`} roughness={0.7} />
            </mesh>
          </group>
        );
      })}

      {/* Seaweed - left side */}
      {[...Array(seaweedCount)].map((_, i) => {
        const x = -45 - (i % 3) * 40;
        return (
          <Float key={`seaweed-left-${i}`} speed={1.2} rotationIntensity={0.05} floatIntensity={0.3}>
            <mesh position={[x, 0, -totalLength / 2 + i * 12]} rotation={[0.12 * i, 0, 0.08]}>
              <boxGeometry args={[0.6, 18, 0.6]} />
              <meshStandardMaterial color="#1a5a3a" transparent opacity={0.75} />
            </mesh>
          </Float>
        );
      })}
      {/* Seaweed - right side */}
      {[...Array(seaweedCount)].map((_, i) => {
        const x = 45 + (i % 3) * 40;
        return (
          <Float key={`seaweed-right-${i}`} speed={1.2} rotationIntensity={0.05} floatIntensity={0.3}>
            <mesh position={[x, 0, -totalLength / 2 + i * 12]} rotation={[0.12 * i, 0, 0.08]}>
              <boxGeometry args={[0.6, 18, 0.6]} />
              <meshStandardMaterial color="#1a5a3a" transparent opacity={0.75} />
            </mesh>
          </Float>
        );
      })}

      {/* Bioluminescent particles - centered but spread out */}
      <Sparkles count={60} scale={25} size={2} speed={0.2} opacity={0.5} color="#00ffff" position={[-40, 15, totalLength / 2]} />
      <Sparkles count={60} scale={25} size={2} speed={0.2} opacity={0.5} color="#00ffff" position={[40, 15, totalLength / 2]} />
      <Sparkles count={40} scale={20} size={1.5} speed={0.15} opacity={0.4} color="#ff00ff" position={[-35, 10, totalLength / 2]} />
      <Sparkles count={40} scale={20} size={1.5} speed={0.15} opacity={0.4} color="#ff00ff" position={[35, 10, totalLength / 2]} />

      {/* Underwater lighting */}
      <pointLight position={[0, -5, 0]} intensity={1} color="#004488" distance={80} />
      <pointLight position={[0, 20, totalLength / 2]} intensity={0.8} color="#0088ff" distance={60} />
    </group>
  );
}

function GalaxyNebulaEnvironment({ totalLength }: { totalLength: number }) {
  const nebulaCount = Math.max(Math.ceil(totalLength / 60), 3);

  return (
    <group position={[0, 40, totalLength / 2]}>
      {[...Array(nebulaCount)].map((_, n) => (
        <group key={n} position={[0, 0, -totalLength / 2 + n * 60 + 30]}>
          {/* Nebula clouds */}
          {[...Array(12)].map((_, i) => (
            <mesh key={i} position={[
              Math.cos(i * 0.7) * 35 + n * 10,
              Math.sin(i * 0.4) * 25 + n * 5,
              Math.sin(i * 0.25) * 25
            ]}>
              <sphereGeometry args={[18 + i * 2.5, 16, 16]} />
              <meshBasicMaterial color={`hsl(${240 + i * 18}, 85%, 42%)`} transparent opacity={0.12} />
            </mesh>
          ))}
          {/* Stars cluster */}
          {[...Array(40)].map((_, i) => (
            <mesh key={`star-${i}`} position={[
              (i * 19 % 90) - 45,
              (i * 27 % 70) - 35,
              (i * 13 % 50) - 25,
            ]}>
              <sphereGeometry args={[0.35, 6, 6]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
          ))}
          {/* Distant galaxies */}
          <mesh position={[50, -20, -30]}>
            <sphereGeometry args={[8, 12, 12]} />
            <meshBasicMaterial color="#ffaaff" transparent opacity={0.3} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function MatrixRainEnvironment({ totalLength, frame = 0 }: { totalLength: number; frame?: number }) {
  const rainCount = Math.max(Math.ceil(totalLength / 4), 50);

  return (
    <group position={[0, 35, totalLength / 2]}>
      {[...Array(rainCount)].map((_, i) => (
        <mesh key={i} position={[
          -70 + (i % 22) * 7,
          (i * 8 % 35) - 18,
          -totalLength / 2 + (i % Math.ceil(totalLength / 8)) * 8
        ]}>
          <boxGeometry args={[0.6, 12 + (i * 4 % 22), 0.15]} />
          <meshBasicMaterial color="#00ff00" transparent opacity={0.45 + (i * 7 % 12) / 27} />
        </mesh>
      ))}
    </group>
  );
}

function IceGlacierEnvironment({ totalLength }: { totalLength: number }) {
  const icebergCount = Math.max(Math.ceil(totalLength / 12), 10);

  return (
    <group position={[0, 0, totalLength / 2]}>
      {/* Icebergs with realistic crystalline appearance */}
      {[...Array(icebergCount)].map((_, i) => (
        <mesh key={i} position={[-90 + (i % 7) * 30, 6 + (i % 3) * 3, -totalLength / 2 + i * 14]} rotation={[0, i * 0.45, 0]} castShadow>
          <icosahedronGeometry args={[12 + (i * 4 % 6), 1]} />
          <meshStandardMaterial
            color="#a8d8ea"
            transparent
            opacity={0.82}
            metalness={0.15}
            roughness={0.15}
            envMapIntensity={1.2}
          />
        </mesh>
      ))}

      {/* Reflective ice floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.8, 0]}>
        <planeGeometry args={[250, totalLength + 120]} />
        <MeshReflectorMaterial
          blur={[200, 80]}
          resolution={512}
          mixBlur={1}
          mixStrength={40}
          roughness={0.7}
          depthScale={1.1}
          minDepthThreshold={0.5}
          maxDepthThreshold={1.3}
          color="#d4f1f9"
          metalness={0.2}
        />
      </mesh>

      {/* Ice crystals */}
      <Sparkles count={60} scale={15} size={1.5} speed={0.1} opacity={0.4} color="#ffffff" position={[0, 8, totalLength / 2]} />
    </group>
  );
}

function SteampunkGearsEnvironment({ totalLength, frame = 0 }: { totalLength: number; frame?: number }) {
  const gearCount = Math.max(Math.ceil(totalLength / 20), 8);
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.children.forEach((child, i) => {
        if (i % 2 === 0) {
          child.rotation.z = frame * 0.01 * (i % 3 + 1) * 0.5;
        } else {
          child.rotation.z = -frame * 0.008 * (i % 3 + 1) * 0.5;
        }
      });
    }
  });

  return (
    <group ref={groupRef} position={[0, 18, totalLength / 2]}>
      {/* Gears */}
      {[...Array(gearCount)].map((_, i) => (
        <mesh key={i} position={[-45 + (i % 5) * 22, Math.sin(i) * 12, -totalLength / 2 + i * 22]} rotation={[i * 0.5, i * 0.35, 0]}>
          <torusGeometry args={[9 + (i * 4 % 5), 1.2, 10, 16]} />
          <meshStandardMaterial color="#8b4513" metalness={0.85} roughness={0.35} />
        </mesh>
      ))}

      {/* Pipes */}
      {[...Array(Math.ceil(totalLength / 35))].map((_, i) => (
        <mesh key={`pipe-${i}`} position={[0, -12 + (i % 4) * 10, -totalLength / 2 + i * 35]} rotation={[Math.PI / 2, 0, i * 0.25]}>
          <cylinderGeometry args={[1.2, 1.2, totalLength * 0.55, 10]} />
          <meshStandardMaterial color="#654321" metalness={0.75} roughness={0.45} />
        </mesh>
      ))}

      {/* Steam vents */}
      <Sparkles count={40} scale={10} size={2} speed={0.4} opacity={0.35} color="#aaaaaa" position={[0, 5, 0]} />
    </group>
  );
}

function AlienPlanetEnvironment({ totalLength, frame = 0 }: { totalLength: number; frame?: number }) {
  const terrainCount = Math.max(Math.ceil(totalLength / 10), 12);
  const mushroomCount = Math.max(Math.ceil(totalLength / 12), 10);

  return (
    <group position={[0, 0, totalLength / 2]}>
      {/* Alien terrain */}
      {[...Array(terrainCount)].map((_, i) => (
        <mesh key={i} position={[-55 + (i % 9) * 14, 3, -totalLength / 2 + i * 10]} rotation={[0, i * 0.55, 0]} castShadow>
          <dodecahedronGeometry args={[6 + (i * 3 % 7), 1]} />
          <meshStandardMaterial color={`hsl(${270 + i * 18}, 65%, 32%)`} flatShading roughness={0.8} />
        </mesh>
      ))}

      {/* Glowing mushrooms */}
      {[...Array(mushroomCount)].map((_, i) => (
        <group key={`mushroom-${i}`} position={[-35 + (i % 5) * 18, 0, -totalLength / 2 + i * 12]}>
          {/* Stem */}
          <mesh position={[0, 3.5, 0]} castShadow>
            <cylinderGeometry args={[0.6, 1.2, 7, 8]} />
            <meshStandardMaterial color="#2a0a3a" roughness={0.85} />
          </mesh>
          {/* Glowing cap */}
          <mesh position={[0, 8, 0]} castShadow>
            <sphereGeometry args={[2.5, 12, 12]} />
            <meshBasicMaterial color={`hsl(${290 + i * 20}, 90%, 55%)`} transparent opacity={0.85} />
          </mesh>
          {/* Glow */}
          <pointLight position={[0, 8, 0]} intensity={0.7} color={`hsl(${290 + i * 20}, 90%, 55%)`} distance={18} />
        </group>
      ))}

      {/* Alien atmosphere */}
      <Sparkles count={80} scale={20} size={1.8} speed={0.15} opacity={0.45} color="#ff00ff" position={[0, 15, totalLength / 2]} />
    </group>
  );
}

function TronGridEnvironment({ totalLength, frame = 0 }: { totalLength: number; frame?: number }) {
  const gridLength = Math.max(totalLength + 100, 200);
  const verticalLineCount = Math.max(Math.ceil(totalLength / 16), 12);
  const beamCount = Math.max(Math.ceil(totalLength / 35), 6);
  const CORRIDOR_WIDTH = 16;

  return (
    <group position={[0, 0, totalLength / 2]}>
      {/* Grid floor - left and right with gap */}
      <gridHelper args={[gridLength / 2 - CORRIDOR_WIDTH / 2, Math.floor(gridLength / 8), '#00ffff', '#003333']} position={[-gridLength / 4 - CORRIDOR_WIDTH / 4, 0.1, 0]} />
      <gridHelper args={[gridLength / 2 - CORRIDOR_WIDTH / 2, Math.floor(gridLength / 8), '#00ffff', '#003333']} position={[gridLength / 4 + CORRIDOR_WIDTH / 4, 0.1, 0]} />

      {/* Vertical lines - left side */}
      {[...Array(verticalLineCount)].map((_, i) => (
        <mesh key={`left-${i}`} position={[-60 - (i % 3) * 30, 28, -totalLength / 2 + i * 16]}>
          <boxGeometry args={[0.35, 56, 0.35]} />
          <meshBasicMaterial color="#00ffff" transparent opacity={0.65} />
        </mesh>
      ))}
      {/* Vertical lines - right side */}
      {[...Array(verticalLineCount)].map((_, i) => (
        <mesh key={`right-${i}`} position={[60 + (i % 3) * 30, 28, -totalLength / 2 + i * 16]}>
          <boxGeometry args={[0.35, 56, 0.35]} />
          <meshBasicMaterial color="#00ffff" transparent opacity={0.65} />
        </mesh>
      ))}

      {/* Horizontal beams - left side */}
      {[...Array(beamCount)].map((_, i) => (
        <mesh key={`beam-left-${i}`} position={[-40, 12 + (i % 4) * 18, -totalLength / 2 + i * 35]}>
          <boxGeometry args={[gridLength / 2, 0.35, 0.35]} />
          <meshBasicMaterial color={i % 2 === 0 ? '#ff00ff' : '#00ffff'} transparent opacity={0.65} />
        </mesh>
      ))}
      {/* Horizontal beams - right side */}
      {[...Array(beamCount)].map((_, i) => (
        <mesh key={`beam-right-${i}`} position={[40, 12 + (i % 4) * 18, -totalLength / 2 + i * 35]}>
          <boxGeometry args={[gridLength / 2, 0.35, 0.35]} />
          <meshBasicMaterial color={i % 2 === 0 ? '#00ffff' : '#ff00ff'} transparent opacity={0.65} />
        </mesh>
      ))}

      {/* Energy pulses - sides only */}
      <Sparkles count={25} scale={15} size={1.2} speed={0.6} opacity={0.5} color="#00ffff" position={[-40, 5, totalLength / 2]} />
      <Sparkles count={25} scale={15} size={1.2} speed={0.6} opacity={0.5} color="#00ffff" position={[40, 5, totalLength / 2]} />
    </group>
  );
}

// ============================================================================
// IMMERSIVE ENVIRONMENT PRESETS - ENHANCED
// ============================================================================

function FootballStadiumEnvironment({ totalLength }: { totalLength: number }) {
  const stadiumLength = Math.max(totalLength + 80, 160);
  const numSeats = Math.ceil(stadiumLength / 12);

  return (
    <group position={[0, 0, stadiumLength / 2 - 40]}>
      {/* Stadium walls */}
      {[-65, 65].map((x, side) => (
        <mesh key={`wall-${side}`} position={[x, 18, 0]} castShadow>
          <boxGeometry args={[22, 40, stadiumLength]} />
          <meshStandardMaterial color="#1a1a2e" metalness={0.35} roughness={0.7} />
        </mesh>
      ))}

      {/* Seats with color variation */}
      {[...Array(numSeats)].map((_, i) => (
        <group key={`seat-row-${i}`}>
          <mesh position={[-50, 9 + (i % 3) * 2.5, -stadiumLength / 2 + i * 12]} rotation={[0, 0, 0.22]}>
            <boxGeometry args={[14, 12, 14]} />
            <meshStandardMaterial color={i % 3 === 0 ? '#cc0000' : i % 3 === 1 ? '#ffffff' : '#0066cc'} />
          </mesh>
          <mesh position={[50, 9 + (i % 3) * 2.5, -stadiumLength / 2 + i * 12]} rotation={[0, 0, -0.22]}>
            <boxGeometry args={[14, 12, 14]} />
            <meshStandardMaterial color={i % 3 === 0 ? '#0066cc' : i % 3 === 1 ? '#ffffff' : '#cc0000'} />
          </mesh>
        </group>
      ))}

      {/* Field */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <planeGeometry args={[90, stadiumLength]} />
        <meshStandardMaterial color="#2d5a2d" roughness={0.9} />
      </mesh>

      {/* Field lines */}
      {[...Array(Math.ceil(stadiumLength / 12))].map((_, i) => (
        <mesh key={`line-${i}`} position={[0, 0.1, -stadiumLength / 2 + i * 12]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[90, 0.6]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      ))}

      {/* Stadium lights */}
      {[-58, 58].map((x, side) => (
        [...Array(Math.ceil(stadiumLength / 70))].map((_, i) => (
          <group key={`light-${side}-${i}`} position={[x, 45, 45 + i * 70]}>
            <mesh><boxGeometry args={[5, 28, 5]} /><meshStandardMaterial color="#444444" /></mesh>
            <SpotLight position={[0, -12, 0]} intensity={2.5} color="#ffffcc" angle={0.8} penumbra={0.5} distance={120} castShadow />
          </group>
        ))
      ))}
    </group>
  );
}

function RaceTrackEnvironment({ totalLength }: { totalLength: number }) {
  const trackLength = Math.max(totalLength + 100, 220);

  return (
    <group position={[0, 0, trackLength / 2]}>
      {/* Track surface */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.12, 0]} receiveShadow>
        <planeGeometry args={[90, trackLength]} />
        <meshStandardMaterial color="#333333" roughness={0.96} />
      </mesh>

      {/* Track edges with barriers */}
      {[-38, 38].map((x, side) => (
        <mesh key={`edge-${side}`} position={[x, 0.35, 0]}>
          <boxGeometry args={[2.5, 0.6, trackLength]} />
          <meshStandardMaterial color="#ffffff" roughness={0.7} />
        </mesh>
      ))}

      {/* Track markings */}
      {[...Array(Math.ceil(trackLength / 16))].map((_, i) => (
        <mesh key={`mark-${i}`} position={[0, 0.18, -trackLength / 2 + i * 16]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[70, 1.2]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      ))}

      {/* Grandstands */}
      {[-58, 58].map((x, side) => (
        <mesh key={`stand-${side}`} position={[x, 14, 0]} castShadow>
          <boxGeometry args={[22, 28, trackLength * 0.92]} />
          <meshStandardMaterial color="#1a1a2e" metalness={0.35} />
        </mesh>
      ))}

      {/* Start/finish line */}
      {[...Array(10)].map((_, i) => (
        <mesh key={`check-${i}`} position={[-12 + i * 2.8, 0.19, trackLength / 2 - 32]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[2.5, 2.5]} />
          <meshBasicMaterial color={i % 2 === 0 ? '#000000' : '#ffffff'} />
        </mesh>
      ))}
    </group>
  );
}

function ConcertStageEnvironment({ totalLength, frame = 0 }: { totalLength: number; frame?: number }) {
  const stageLength = Math.max(totalLength + 60, 130);

  return (
    <group position={[0, 0, stageLength / 2]}>
      {/* Main stage platform */}
      <mesh position={[0, 1.8, 0]} castShadow receiveShadow>
        <boxGeometry args={[110, 3.5, stageLength]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.65} roughness={0.35} />
      </mesh>

      {/* Stage rigging */}
      <mesh position={[0, 38, 0]} castShadow>
        <boxGeometry args={[120, 3.5, stageLength]} />
        <meshStandardMaterial color="#252525" metalness={0.85} roughness={0.2} />
      </mesh>

      {/* Dynamic stage lights */}
      {[...Array(Math.ceil(stageLength / 16))].map((_, i) => (
        <group key={`light-row-${i}`} position={[0, 32, -stageLength / 2 + 10 + i * 16]}>
          {[-45, 0, 45].map((x, j) => (
            <group key={`light-${j}`} position={[x, 0, 0]}>
              <mesh><sphereGeometry args={[2.5, 10, 10]} /><meshStandardMaterial color="#151515" metalness={0.85} /></mesh>
              <SpotLight
                intensity={3.5}
                color={`hsl(${(i * 35 + j * 45) % 360}, 100%, 55%)`}
                angle={0.7}
                penumbra={0.6}
                distance={55}
              />
            </group>
          ))}
        </group>
      ))}

      {/* Speaker stacks */}
      {[-58, 58].map((x, side) => (
        [...Array(Math.ceil(stageLength / 55))].map((_, i) => (
          <group key={`speaker-${side}-${i}`} position={[x, 14, -stageLength / 2 + 28 + i * 55]}>
            <mesh castShadow><boxGeometry args={[14, 28, 10]} /><meshStandardMaterial color="#1a1a1a" /></mesh>
            <mesh position={[0, 6, 5.1]}><circleGeometry args={[4.5, 20]} /><meshStandardMaterial color="#383838" /></mesh>
            <mesh position={[0, -6, 5.1]}><circleGeometry args={[3.5, 20]} /><meshStandardMaterial color="#383838" /></mesh>
          </group>
        ))
      ))}

      {/* Crowd particles */}
      <Sparkles count={200} scale={40} size={1} speed={0.05} opacity={0.15} color="#ffffff" position={[0, 5, 0]} />
    </group>
  );
}

function CastleGroundsEnvironment({ totalLength }: { totalLength: number }) {
  const groundsLength = Math.max(totalLength + 80, 170);

  return (
    <group position={[0, 0, groundsLength / 2]}>
      {/* Castle walls */}
      {[-68, 68].map((x, side) => (
        <mesh key={`wall-${side}`} position={[x, 18, 0]} castShadow>
          <boxGeometry args={[18, 40, groundsLength]} />
          <meshStandardMaterial color="#4a4a5a" roughness={0.92} />
        </mesh>
      ))}

      {/* Towers */}
      {[-68, 68].map((x, side) => (
        [...Array(Math.ceil(groundsLength / 55))].map((_, i) => (
          <group key={`tower-${side}-${i}`} position={[x, 35, -groundsLength / 2 + 28 + i * 55]}>
            <mesh castShadow><cylinderGeometry args={[9, 11, 50, 10]} /><meshStandardMaterial color="#3a3a4a" roughness={0.92} /></mesh>
            <mesh position={[0, 32, 0]} castShadow><coneGeometry args={[11, 18, 10]} /><meshStandardMaterial color="#2a2a3a" /></mesh>
          </group>
        ))
      ))}

      {/* Stone floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow>
        <planeGeometry args={[120, groundsLength]} />
        <meshStandardMaterial color="#605545" roughness={0.96} />
      </mesh>

      {/* Torches with flickering light */}
      {[...Array(Math.ceil(groundsLength / 26))].map((_, i) => (
        <group key={`torch-${i}`}>
          <mesh position={[-48, 9, -groundsLength / 2 + i * 26]}><cylinderGeometry args={[0.45, 0.45, 12, 8]} /><meshStandardMaterial color="#4a3020" /></mesh>
          <pointLight position={[-48, 16, -groundsLength / 2 + i * 26]} intensity={1.8} color="#ff6600" distance={35} />
          <mesh position={[48, 9, -groundsLength / 2 + i * 26 + 13]}><cylinderGeometry args={[0.45, 0.45, 12, 8]} /><meshStandardMaterial color="#4a3020" /></mesh>
          <pointLight position={[48, 16, -groundsLength / 2 + i * 26 + 13]} intensity={1.8} color="#ff6600" distance={35} />
        </group>
      ))}
    </group>
  );
}

function AirportRunwayEnvironment({ totalLength }: { totalLength: number }) {
  const runwayLength = Math.max(totalLength + 130, 260);

  return (
    <group position={[0, 0, runwayLength / 2]}>
      {/* Runway */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.12, 0]} receiveShadow>
        <planeGeometry args={[45, runwayLength]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.96} />
      </mesh>

      {/* Center line */}
      {[...Array(Math.ceil(runwayLength / 15))].map((_, i) => (
        <mesh key={`center-${i}`} position={[0, 0.16, -runwayLength / 2 + i * 15]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[2.5, 12]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      ))}

      {/* Edge lights */}
      {[-20, 20].map((x, side) => (
        [...Array(Math.ceil(runwayLength / 12))].map((_, i) => (
          <group key={`light-${side}-${i}`} position={[x, 0.55, -runwayLength / 2 + i * 12]}>
            <mesh><sphereGeometry args={[0.45, 10, 10]} /><meshBasicMaterial color={side === -20 ? '#00ff00' : '#ff0000'} /></mesh>
            <pointLight position={[0, 0.5, 0]} intensity={0.5} color={side === -20 ? '#00ff00' : '#ff0000'} distance={15} />
          </group>
        ))
      ))}

      {/* Terminal buildings */}
      {[-85, 85].map((x, side) => (
        <mesh key={`terminal-${side}`} position={[x, 18, 0]} castShadow>
          <boxGeometry args={[55, 36, runwayLength * 0.72]} />
          <meshStandardMaterial color="#3a3a4a" metalness={0.35} roughness={0.65} />
        </mesh>
      ))}

      {/* Control towers */}
      {[...Array(Math.ceil(runwayLength / 140))].map((_, i) => (
        <group key={`tower-${i}`} position={[75, 0, -runwayLength / 2 + 70 + i * 140]}>
          <mesh position={[0, 20, 0]} castShadow><cylinderGeometry args={[5.5, 6.5, 40, 10]} /><meshStandardMaterial color="#484848" /></mesh>
          <mesh position={[0, 44, 0]} castShadow><cylinderGeometry args={[9, 5.5, 10, 10]} /><meshStandardMaterial color="#363636" metalness={0.55} /></mesh>
        </group>
      ))}
    </group>
  );
}

function ThemeParkEnvironment({ totalLength }: { totalLength: number }) {
  const parkLength = Math.max(totalLength + 60, 150);

  return (
    <group position={[0, 0, parkLength / 2]}>
      {/* Ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow>
        <planeGeometry args={[160, parkLength]} />
        <meshStandardMaterial color="#2a5a2a" roughness={0.95} />
      </mesh>

      {/* Ferris wheels */}
      {[-65, 65].map((x, side) => (
        [...Array(Math.ceil(parkLength / 90))].map((_, i) => (
          <group key={`ferris-${side}-${i}`} position={[x, 35, -parkLength / 2 + 45 + i * 90]}>
            <mesh rotation={[0, 0, Math.PI / 2]} castShadow><torusGeometry args={[25, 1.8, 10, 40]} /><meshStandardMaterial color="#ff4444" metalness={0.55} /></mesh>
            {[...Array(8)].map((_, j) => (
              <mesh key={j} position={[Math.cos(j * 0.785) * 25, Math.sin(j * 0.785) * 25, 0]} castShadow>
                <boxGeometry args={[6, 7, 5]} />
                <meshStandardMaterial color={`hsl(${j * 45}, 75%, 52%)`} />
              </mesh>
            ))}
            {/* Support structure */}
            <mesh position={[0, -12, 0]}><cylinderGeometry args={[1.5, 2, 24, 8]} /><meshStandardMaterial color="#666666" metalness={0.7} /></mesh>
          </group>
        ))
      ))}

      {/* Carousels */}
      {[...Array(Math.ceil(parkLength / 65))].map((_, i) => (
        <group key={`carousel-${i}`} position={[0, 6, -parkLength / 2 + 32 + i * 65]}>
          <mesh castShadow><cylinderGeometry args={[12, 12, 1.2, 20]} /><meshStandardMaterial color="#ffcc00" metalness={0.4} /></mesh>
          {[...Array(8)].map((_, j) => (
            <mesh key={j} position={[Math.cos(j * 0.785) * 8, 5, Math.sin(j * 0.785) * 8]} castShadow>
              <boxGeometry args={[1.8, 8, 1.8]} />
              <meshStandardMaterial color={`hsl(${j * 45}, 65%, 52%)`} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function AncientRuinsEnvironment({ totalLength }: { totalLength: number }) {
  const ruinsLength = Math.max(totalLength + 50, 130);

  return (
    <group position={[0, 0, ruinsLength / 2]}>
      {/* Stone floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow>
        <planeGeometry args={[110, ruinsLength]} />
        <meshStandardMaterial color="#706050" roughness={0.98} />
      </mesh>

      {/* Columns */}
      {[-45, 45].map((x, side) => (
        [...Array(Math.ceil(ruinsLength / 18))].map((_, i) => (
          <group key={`col-${side}-${i}`} position={[x, 0, -ruinsLength / 2 + i * 18]}>
            <mesh position={[0, i % 3 === 0 ? 6 : 14, 0]} castShadow>
              <cylinderGeometry args={[2.2, 2.8, i % 3 === 0 ? 12 : 28, 14]} />
              <meshStandardMaterial color="#a09080" roughness={0.92} />
            </mesh>
            {i % 3 !== 0 && (
              <mesh position={[0, 29, 0]} castShadow>
                <boxGeometry args={[5.5, 3.5, 5.5]} />
                <meshStandardMaterial color="#908070" roughness={0.92} />
              </mesh>
            )}
          </group>
        ))
      ))}

      {/* Debris */}
      {[...Array(Math.ceil(ruinsLength / 12))].map((_, i) => (
        <mesh key={`debris-${i}`} position={[(i % 2 === 0 ? -1 : 1) * (22 + (i % 5) * 9), 1.2, -ruinsLength / 2 + i * 12]} rotation={[i * 0.32, i * 0.55, 0]} castShadow>
          <boxGeometry args={[3.5 + i % 2, 2.5, 3.5 + i % 3]} />
          <meshStandardMaterial color="#908070" roughness={0.96} />
        </mesh>
      ))}
    </group>
  );
}

function ZenGardenEnvironment({ totalLength }: { totalLength: number }) {
  const gardenLength = Math.max(totalLength + 40, 110);

  return (
    <group position={[0, 0, gardenLength / 2]}>
      {/* Sand */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow>
        <planeGeometry args={[110, gardenLength]} />
        <meshStandardMaterial color="#e8e0d0" roughness={1} />
      </mesh>

      {/* Raked lines */}
      {[...Array(Math.ceil(gardenLength / 6))].map((_, i) => (
        <mesh key={i} position={[0, 0.06, -gardenLength / 2 + i * 6]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[110, 0.6]} />
          <meshBasicMaterial color="#d0c8b8" />
        </mesh>
      ))}

      {/* Rocks */}
      {[...Array(Math.ceil(gardenLength / 30))].map((_, i) => (
        <mesh key={`rock-${i}`} position={[(i % 2 === 0 ? -1 : 1) * 35, 5, -gardenLength / 2 + 15 + i * 30]} rotation={[i * 0.22, i * 0.35, i * 0.18]} castShadow>
          <dodecahedronGeometry args={[6, 1]} />
          <meshStandardMaterial color="#4a4a4a" roughness={0.88} />
        </mesh>
      ))}

      {/* Bamboo fence */}
      {[-52, 52].map((x, side) => (
        [...Array(Math.ceil(gardenLength / 4))].map((_, i) => (
          <mesh key={`bamboo-${side}-${i}`} position={[x, 5.5, -gardenLength / 2 + i * 4]} castShadow>
            <cylinderGeometry args={[0.35, 0.35, 11, 8]} />
            <meshStandardMaterial color="#5a8a4a" roughness={0.72} />
          </mesh>
        ))
      ))}
    </group>
  );
}

function SkiResortEnvironment({ totalLength }: { totalLength: number }) {
  const resortLength = Math.max(totalLength + 90, 200);

  return (
    <group position={[0, 0, resortLength / 2]}>
      {/* Snow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow>
        <planeGeometry args={[170, resortLength]} />
        <meshStandardMaterial color="#f0f5ff" roughness={0.92} />
      </mesh>

      {/* Mountain slopes */}
      {[-90, 90].map((x, side) => (
        <mesh key={`slope-${side}`} position={[x, 40, 0]} rotation={[0, 0, side * 0.42]} castShadow>
          <coneGeometry args={[80, 100, 5]} />
          <meshStandardMaterial color="#ffffff" roughness={0.93} />
        </mesh>
      ))}

      {/* Lift towers */}
      {[-42, 42].map((x, side) => (
        [...Array(Math.ceil(resortLength / 45))].map((_, i) => (
          <mesh key={`lift-${side}-${i}`} position={[x, 20, -resortLength / 2 + 22 + i * 45]} castShadow>
            <boxGeometry args={[3, 40, 3]} />
            <meshStandardMaterial color="#484848" metalness={0.55} />
          </mesh>
        ))
      ))}

      {/* Lodges */}
      {[...Array(Math.ceil(resortLength / 110))].map((_, i) => (
        <group key={`lodge-${i}`} position={[65, 12, -resortLength / 2 + 55 + i * 110]} castShadow>
          <mesh><boxGeometry args={[40, 24, 50]} /><meshStandardMaterial color="#8b4513" roughness={0.92} /></mesh>
          <mesh position={[0, 14, 0]}><boxGeometry args={[44, 12, 54]} /><meshStandardMaterial color="#5a3a13" roughness={0.88} /></mesh>
        </group>
      ))}
    </group>
  );
}

function UnderwaterKingdomEnvironment({ totalLength, frame = 0 }: { totalLength: number; frame?: number }) {
  const kingdomLength = Math.max(totalLength + 60, 150);

  return (
    <group position={[0, 0, kingdomLength / 2]}>
      {/* Ocean floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -12, 0]} receiveShadow>
        <planeGeometry args={[170, kingdomLength]} />
        <meshStandardMaterial color="#001a33" roughness={0.96} />
      </mesh>

      {/* Coral castles */}
      {[-65, 65].map((x, side) => (
        [...Array(Math.ceil(kingdomLength / 55))].map((_, i) => (
          <group key={`castle-${side}-${i}`} position={[x, 22, -kingdomLength / 2 + 28 + i * 55]}>
            <mesh castShadow><cylinderGeometry args={[12, 16, 50, 8]} /><meshStandardMaterial color={`hsl(${195 + i * 22}, 65%, 42%)`} roughness={0.72} /></mesh>
            <mesh position={[0, 32, 0]} castShadow><coneGeometry args={[14, 24, 8]} /><meshStandardMaterial color={`hsl(${175 + i * 22}, 75%, 52%)`} /></mesh>
          </group>
        ))
      ))}

      {/* Seaweed */}
      {[...Array(Math.ceil(kingdomLength / 10))].map((_, i) => (
        <Float key={`seaweed-${i}`} speed={1} rotationIntensity={0.03} floatIntensity={0.25}>
          <mesh position={[(i % 2 === 0 ? -1 : 1) * 38, 0, -kingdomLength / 2 + i * 10]} rotation={[0.12 * (i % 4), 0, 0.06]}>
            <boxGeometry args={[0.9, 25, 0.9]} />
            <meshStandardMaterial color="#1a5a3a" transparent opacity={0.72} />
          </mesh>
        </Float>
      ))}

      {/* Bioluminescent particles */}
      <Sparkles count={80} scale={30} size={2.2} speed={0.18} opacity={0.55} color="#00ffff" position={[0, 20, kingdomLength / 2]} />
      <Sparkles count={60} scale={25} size={1.8} speed={0.12} opacity={0.45} color="#ff00ff" position={[0, 12, kingdomLength / 2]} />

      {/* Underwater lighting */}
      <pointLight position={[0, -5, 0]} intensity={1.2} color="#004488" distance={90} />
      <pointLight position={[0, 25, kingdomLength / 2]} intensity={0.9} color="#0088ff" distance={70} />
    </group>
  );
}

function CyberpunkCityEnvironment({ totalLength, frame = 0 }: { totalLength: number; frame?: number }) {
  const cityLength = Math.max(totalLength + 45, 130);
  const CORRIDOR_WIDTH = 16; // Clear space in middle for towers

  return (
    <group position={[0, 0, cityLength / 2]}>
      {/* Reflective ground - split with gap */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-40 - CORRIDOR_WIDTH / 2, 0.12, 0]}>
        <planeGeometry args={[80, cityLength]} />
        <meshStandardMaterial color="#08080c" metalness={0.85} roughness={0.25} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[40 + CORRIDOR_WIDTH / 2, 0.12, 0]}>
        <planeGeometry args={[80, cityLength]} />
        <meshStandardMaterial color="#08080c" metalness={0.85} roughness={0.25} />
      </mesh>

      {/* Mega buildings - left side (further left) */}
      {[...Array(Math.ceil(cityLength / 25))].map((_, i) => (
        <group key={`mega-left-${i}`} position={[-65 - (i % 2) * 15, 45 + (i % 5) * 18, -cityLength / 2 + i * 25]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[32, 90 + (i % 6) * 28, 25]} />
            <meshStandardMaterial color="#080812" metalness={0.65} roughness={0.35} />
          </mesh>
          <mesh position={[-16, 22 + (i % 3) * 8, 0]}>
            <planeGeometry args={[5, 20]} />
            <meshBasicMaterial color={`hsl(${270 + i * 28}, 100%, 55%)`} transparent opacity={0.85} />
          </mesh>
          <mesh position={[-15.5, 0, 0]}>
            <planeGeometry args={[0.4, 80]} />
            <meshBasicMaterial color={i % 2 === 0 ? '#ff00ff' : '#00ffff'} transparent opacity={0.9} />
          </mesh>
        </group>
      ))}

      {/* Mega buildings - right side (further right) */}
      {[...Array(Math.ceil(cityLength / 25))].map((_, i) => (
        <group key={`mega-right-${i}`} position={[65 + (i % 2) * 15, 45 + (i % 5) * 18, -cityLength / 2 + i * 25]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[32, 90 + (i % 6) * 28, 25]} />
            <meshStandardMaterial color="#080812" metalness={0.65} roughness={0.35} />
          </mesh>
          <mesh position={[16, 22 + (i % 3) * 8, 0]} rotation={[0, Math.PI, 0]}>
            <planeGeometry args={[5, 20]} />
            <meshBasicMaterial color={`hsl(${270 + i * 28}, 100%, 55%)`} transparent opacity={0.85} />
          </mesh>
          <mesh position={[15.5, 0, 0]}>
            <planeGeometry args={[0.4, 80]} />
            <meshBasicMaterial color={i % 2 === 0 ? '#00ffff' : '#ff00ff'} transparent opacity={0.9} />
          </mesh>
        </group>
      ))}

      {/* Street neon lines - sides only */}
      <mesh position={[-40, 0.22, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.5, cityLength]} />
        <meshBasicMaterial color="#ff00ff" transparent opacity={0.95} />
      </mesh>
      <mesh position={[40, 0.22, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.5, cityLength]} />
        <meshBasicMaterial color="#00ffff" transparent opacity={0.95} />
      </mesh>

      {/* Rain/debris */}
      <Sparkles count={150} scale={12} size={1.2} speed={0.7} opacity={0.15} color="#ffffff" position={[0, 25, cityLength / 2]} />
    </group>
  );
}

function MedievalArenaEnvironment({ totalLength }: { totalLength: number }) {
  const arenaLength = Math.max(totalLength + 65, 165);

  return (
    <group position={[0, 0, arenaLength / 2]}>
      {/* Sand floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow>
        <planeGeometry args={[115, arenaLength]} />
        <meshStandardMaterial color="#c2a060" roughness={0.98} />
      </mesh>

      {/* Arena walls */}
      {[-65, 65].map((x, side) => (
        <mesh key={`wall-${side}`} position={[x, 18, 0]} castShadow>
          <boxGeometry args={[18, 40, arenaLength]} />
          <meshStandardMaterial color="#6a5a4a" roughness={0.92} />
        </mesh>
      ))}

      {/* Stands */}
      {[-48, 48].map((x, side) => (
        [...Array(Math.ceil(arenaLength / 22))].map((_, i) => (
          <mesh key={`stand-${side}-${i}`} position={[x, 10 + (i % 3) * 5, -arenaLength / 2 + i * 22]} rotation={[0, 0, side * -0.22]} castShadow>
            <boxGeometry args={[14, 18, 20]} />
            <meshStandardMaterial color="#5a4a3a" roughness={0.92} />
          </mesh>
        ))
      ))}

      {/* Torches */}
      {[...Array(Math.ceil(arenaLength / 30))].map((_, i) => (
        <group key={`torch-${i}`}>
          <mesh position={[-42, 8, -arenaLength / 2 + i * 30]}><cylinderGeometry args={[0.55, 0.55, 14, 8]} /><meshStandardMaterial color="#4a3020" /></mesh>
          <SpotLight position={[-42, 16, -arenaLength / 2 + i * 30]} intensity={2.2} color="#ff6600" angle={0.6} penumbra={0.7} distance={40} />
          <mesh position={[42, 8, -arenaLength / 2 + i * 30 + 15]}><cylinderGeometry args={[0.55, 0.55, 14, 8]} /><meshStandardMaterial color="#4a3020" /></mesh>
          <SpotLight position={[42, 16, -arenaLength / 2 + i * 30 + 15]} intensity={2.2} color="#ff6600" angle={0.6} penumbra={0.7} distance={40} />
        </group>
      ))}
    </group>
  );
}

function SpaceColonyEnvironment({ totalLength }: { totalLength: number }) {
  const colonyLength = Math.max(totalLength + 55, 145);

  return (
    <group position={[0, 0, colonyLength / 2]}>
      {/* Metal floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow>
        <planeGeometry args={[115, colonyLength]} />
        <meshStandardMaterial color="#2a2a3a" metalness={0.75} roughness={0.35} />
      </mesh>

      {/* Colony modules */}
      {[-65, 65].map((x, side) => (
        [...Array(Math.ceil(colonyLength / 45))].map((_, i) => (
          <group key={`module-${side}-${i}`} position={[x, 18, -colonyLength / 2 + 22 + i * 45]}>
            <mesh castShadow><cylinderGeometry args={[14, 14, 35, 14]} /><meshStandardMaterial color="#3a3a4a" metalness={0.65} roughness={0.3} /></mesh>
            <mesh position={[0, 0, side === -65 ? 14 : -14]} castShadow>
              <sphereGeometry args={[12, 14, 14]} />
              <meshStandardMaterial color="#4a4a5a" metalness={0.55} transparent opacity={0.82} />
            </mesh>
          </group>
        ))
      ))}

      {/* Glass domes */}
      {[...Array(Math.ceil(colonyLength / 65))].map((_, i) => (
        <mesh key={`dome-${i}`} position={[0, 30, -colonyLength / 2 + 32 + i * 65]} castShadow>
          <sphereGeometry args={[35, 20, 20, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#88ccff" transparent opacity={0.32} metalness={0.15} roughness={0.08} side={THREE.DoubleSide} />
        </mesh>
      ))}

      {/* Power conduits */}
      {[-32, 32].map((x, i) => (
        <mesh key={`conduit-${i}`} position={[x, 7, 0]}>
          <boxGeometry args={[1.8, 12, colonyLength]} />
          <meshBasicMaterial color="#00ffff" transparent opacity={0.45} />
        </mesh>
      ))}

      {/* Ambient lighting */}
      <pointLight position={[0, 40, colonyLength / 2]} intensity={0.8} color="#4488ff" distance={80} />
    </group>
  );
}

function TropicalBeachEnvironment({ totalLength }: { totalLength: number }) {
  const beachLength = Math.max(totalLength + 55, 145);

  return (
    <group position={[0, 0, beachLength / 2]}>
      {/* Beach */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow>
        <planeGeometry args={[135, beachLength]} />
        <meshStandardMaterial color="#f4d03f" roughness={0.96} />
      </mesh>

      {/* Ocean */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-82, -0.5, 0]}>
        <planeGeometry args={[80, beachLength + 70]} />
        <meshStandardMaterial color="#006994" transparent opacity={0.88} metalness={0.35} roughness={0.55} />
      </mesh>

      {/* Palm trees */}
      {[-55, 55].map((x, side) => (
        [...Array(Math.ceil(beachLength / 22))].map((_, i) => (
          <group key={`palm-${side}-${i}`} position={[x + (i % 4) * 12, 0, -beachLength / 2 + i * 22]}>
            <mesh position={[0, 8, 0]} castShadow><cylinderGeometry args={[0.8, 1.4, 16, 10]} /><meshStandardMaterial color="#8b4513" roughness={0.82} /></mesh>
            <mesh position={[0, 18, 0]} castShadow>
              <sphereGeometry args={[7, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
              <meshStandardMaterial color="#228b22" roughness={0.72} />
            </mesh>
          </group>
        ))
      ))}

      {/* Beach huts */}
      {[...Array(Math.ceil(beachLength / 55))].map((_, i) => (
        <group key={`hut-${i}`} position={[50, 5, -beachLength / 2 + 28 + i * 55]} castShadow>
          <mesh><boxGeometry args={[14, 10, 12]} /><meshStandardMaterial color="#deb887" roughness={0.92} /></mesh>
          <mesh position={[0, 7.5, 0]} rotation={[0.12, 0, 0]}><boxGeometry args={[16, 6, 14]} /><meshStandardMaterial color="#cd853f" roughness={0.88} /></mesh>
        </group>
      ))}

      {/* Umbrellas */}
      {[...Array(Math.ceil(beachLength / 30))].map((_, i) => (
        <group key={`umbrella-${i}`} position={[-22 + (i % 3) * 45, 0, -beachLength / 2 + i * 30]}>
          <mesh position={[0, 5.5, 0]}><cylinderGeometry args={[0.28, 0.28, 11, 10]} /><meshStandardMaterial color="#8b4513" /></mesh>
          <mesh position={[0, 11, 0]} castShadow><coneGeometry args={[5.5, 3.5, 10]} /><meshStandardMaterial color={`hsl(${(i * 65) % 360}, 72%, 52%)`} /></mesh>
        </group>
      ))}
    </group>
  );
}

// ============================================================================
// SYNCHRONIZED CAMERA
// ============================================================================

function SynchronizedCamera({
  cameraPosition,
  lookAt
}: {
  cameraPosition: [number, number, number];
  lookAt: [number, number, number];
}) {
  const { camera, gl } = useThree();

  camera.position.set(...cameraPosition);
  camera.lookAt(...lookAt);
  camera.updateProjectionMatrix();

  const ctx = gl.getContext();
  if (ctx) {
    ctx.finish();
  }

  return null;
}

// ============================================================================
// SCENE COMPONENT
// ============================================================================

function TowerChartScene({
  towers,
  cameraPosition,
  lookAt,
  visibleStart,
  visibleEnd,
  currentIndex,
  introOpacity,
  revealProgress,
  totalItems,
  showLabels3D,
  showGround,
  groundColor,
  backgroundColor,
  ambientIntensity,
  backgroundPreset,
  customModelPath,
  customModelPosition,
  customModelScale,
  customModelRotation,
  towerSpacing,
  labelVisibleEnd,
  frame = 0,
}: {
  towers: ReturnType<typeof calculateTowers>;
  cameraPosition: [number, number, number];
  lookAt: [number, number, number];
  visibleStart: number;
  visibleEnd: number;
  currentIndex: number;
  introOpacity: number;
  revealProgress: number;
  totalItems: number;
  showLabels3D: boolean;
  showGround: boolean;
  groundColor: string;
  backgroundColor: string;
  ambientIntensity: number;
  backgroundPreset: string;
  customModelPath?: string;
  customModelPosition: [number, number, number];
  customModelScale: number;
  customModelRotation: number;
  towerSpacing: number;
  labelVisibleEnd: number;
  frame?: number;
}) {
  return (
    <>
      <color attach="background" args={[backgroundColor]} />
      <fog attach="fog" args={[backgroundColor, 60, 200]} />

      <StarField />
      <FloatingParticles />

      {/* Environment for realistic reflections */}
      <Environment preset="night" />

      {/* Background Environment */}
      <BackgroundEnvironment preset={backgroundPreset} totalLength={towers.length * towerSpacing} frame={frame} />

      {/* Enhanced Lighting Setup */}
      <ambientLight intensity={ambientIntensity * 0.6} />
      <directionalLight
        position={[55, 85, 55]}
        intensity={1.3}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={200}
        shadow-camera-left={-100}
        shadow-camera-right={100}
        shadow-camera-top={100}
        shadow-camera-bottom={-100}
      />
      <directionalLight position={[-45, 55, -45]} intensity={0.5} color="#6666ff" />
      <pointLight position={[0, 85, 0]} intensity={0.7} />
      <hemisphereLight args={['#5555aa', '#222233', 0.5]} />

      {/* Contact shadows for ground */}
      {showGround && (
        <ContactShadows
          position={[0, 0.01, 0]}
          opacity={0.6}
          scale={150}
          blur={2}
          far={50}
        />
      )}

      {showGround && <Ground color={groundColor} />}

      {customModelPath && (
        <Suspense fallback={null}>
          <CustomModel
            modelPath={customModelPath}
            position={customModelPosition}
            scale={customModelScale}
            rotation={customModelRotation}
          />
        </Suspense>
      )}

      {/* Synchronized camera */}
      <SynchronizedCamera cameraPosition={cameraPosition} lookAt={lookAt} />

      {towers.map((tower, index) => {
        const inVisibleRange = index >= visibleStart && index <= visibleEnd;
        const itemReveal = Math.max(0, Math.min(1, (revealProgress * totalItems * 1.2) - index * 0.12));
        const isHighlighted = index === currentIndex || index === currentIndex + 1;
        const labelVisible = index <= labelVisibleEnd && itemReveal > 0.25;

        return (
          <Tower
            key={`tower-${tower.rank}`}
            position={tower.position}
            height={tower.height}
            color={tower.color}
            opacity={itemReveal * introOpacity}
            rank={tower.rank}
            name={tower.name}
            value={tower.valueFormatted}
            subtitle={tower.subtitle}
            image={tower.image}
            showLabel={showLabels3D && labelVisible}
            isHighlighted={isHighlighted}
            visible={inVisibleRange || itemReveal > 0}
          />
        );
      })}

      {/* Post-processing Effects */}
      <EffectComposer disableNormalPass>
        <Bloom
          luminanceThreshold={0.85}
          mipmapBlur
          intensity={0.8}
          radius={0.6}
        />
        <Vignette eskil={false} offset={0.12} darkness={0.55} />
        <Noise opacity={0.02} />
        <ChromaticAberration
          blendFunction={BlendFunction.NORMAL}
          offset={[0.0008, 0.0008]}
        />
      </EffectComposer>
    </>
  );
}

function CustomModel({ modelPath, position, scale, rotation }: {
  modelPath: string;
  position: [number, number, number];
  scale: number;
  rotation: number;
}) {
  const gltf = useGLTF(modelPath);
  const scene = gltf?.scene;

  useEffect(() => {
    if (scene) {
      scene.position.set(0, 0, 0);
      scene.rotation.set(0, 0, 0);
      scene.scale.set(1, 1, 1);
    }
  }, [scene]);

  if (!scene) return null;

  return <primitive object={scene.clone()} position={position} scale={scale} rotation={[0, rotation * Math.PI / 180, 0]} />;
}

// ============================================================================
// CALCULATE TOWERS
// ============================================================================

function calculateTowers(
  items: TowerChart3DBlock['items'],
  towerSpacing: number,
  baseHeight: number,
  maxHeight: number,
  gradientStart: string,
  gradientEnd: string,
  useGradientByRank: boolean,
  animationDirection: string
) {
  if (!items || items.length === 0) return [];

  const sorted = [...items].sort((a, b) => a.rank - b.rank);
  const sortedItems = animationDirection === 'bottom-to-top' ? sorted.reverse() : sorted;

  // Filter items to only include those with valid numeric values
  const validItems = sortedItems.filter((i) =>
    typeof i?.value === 'number' && !isNaN(i.value)
  );

  if (validItems.length === 0) return [];

  const values = validItems.map(i => i.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const heightRange = maxHeight - baseHeight;

  return validItems.map((item, index) => {
    const normalizedValue = (item.value - minValue) / (maxValue - minValue || 1);
    const height = baseHeight + normalizedValue * heightRange;
    const color = useGradientByRank
      ? lerpColor(gradientEnd, gradientStart, (validItems.length - item.rank) / Math.max(validItems.length - 1, 1))
      : (item.color || gradientStart);

    return {
      ...item,
      height,
      color,
      position: [0, 0, index * towerSpacing] as [number, number, number],
      valueFormatted: item.valueFormatted || formatValue(item.value),
    };
  });
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export interface TowerChart3DSceneProps {
  data: TowerChart3DBlock;
  theme?: string;
  motionProfile?: MotionProfileType;
  animation?: AnimationPhase;
}

export function TowerChart3DScene({ data }: TowerChart3DSceneProps): React.ReactElement {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Detect preview mode (small dimensions) vs full render
  const isPreview = width < 500;

  const handleRef = useRef<number | null>(null);
  const [glReady, setGlReady] = useState(false);

  // Initialize delayRender handle on mount
  useEffect(() => {
    handleRef.current = delayRender('Initializing 3D scene');
    return () => {
      if (handleRef.current !== null) {
        cancelRender(handleRef.current);
      }
    };
  }, []);

  const {
    title = 'Rankings',
    subtitle,
    backgroundColor = '#050510',
    items = [],
    gradientStart = '#3B82F6',
    gradientEnd = '#8B5CF6',
    useGradientByRank = true,
    showLabels3D = true,
    cameraDistance = 35,
    cameraPauseDuration = 0.4,
    cameraMoveSpeed = 0.5,
    cameraAngle = 35,
    groundColor = '#0a0a1f',
    showGround = true,
    ambientIntensity = 0.5,
    itemRevealDelay = 0.06,
    towerSpacing = 10,
    baseHeight = 4,
    maxHeight = 30,
    backgroundPreset = 'cyber-grid',
    customModelPath,
    customModelPosition,
    customModelScale = 2,
    customModelRotation = 0,
    animationDirection = 'top-to-bottom',
  } = data;

  useEffect(() => {
    if (customModelPath) {
      preloadModel(customModelPath);
    }
  }, [customModelPath]);

  // Calculations
  const introDuration = 40;
  const totalItems = items.length;
  const pauseFrames = cameraPauseDuration * fps;
  const moveFrames = cameraMoveSpeed * fps;
  const totalAnimFrames = totalItems * (pauseFrames + moveFrames);

  const animFrame = Math.max(0, frame - introDuration);
  const animProgress = totalAnimFrames > 0 ? Math.min(animFrame / totalAnimFrames, 1) : 0;
  const currentIndex = Math.min(Math.floor(animProgress * totalItems), totalItems - 1);
  const itemProgress = (animProgress * totalItems) % 1;

  const introOpacity = Math.min(1, frame / introDuration);
  const revealProgress = Math.min(1, frame / (introDuration + totalItems * itemRevealDelay * fps * 0.5));

  const visibleStart = Math.max(0, currentIndex - 1);
  const visibleEnd = Math.min(items.length - 1, currentIndex + 4);

  const labelVisibleEnd = items.length - 1;

  const towers = useMemo(() =>
    calculateTowers(items, towerSpacing, baseHeight, maxHeight, gradientStart, gradientEnd, useGradientByRank, animationDirection),
    [items, towerSpacing, baseHeight, maxHeight, gradientStart, gradientEnd, useGradientByRank, animationDirection]
  );

  // Use closer camera for preview (25), further for render (35)
  const effectiveCameraDistance = isPreview ? 25 : cameraDistance;

  const cameraState = useMemo(() =>
    calculateCameraState(
      towers.map(t => ({ position: t.position, height: t.height })),
      currentIndex,
      itemProgress,
      effectiveCameraDistance,
      cameraAngle
    ),
    [towers, currentIndex, itemProgress, effectiveCameraDistance, cameraAngle]
  );

  const modelPos: [number, number, number] = customModelPosition
    ? [customModelPosition.x, customModelPosition.y, customModelPosition.z]
    : [0, 35, -60];

  useEffect(() => {
    if (glReady && handleRef.current !== null) {
      continueRender(handleRef.current);
      handleRef.current = null;
    }
  }, [glReady]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!glReady) {
        console.warn('Canvas initialization timeout, continuing render anyway');
        setGlReady(true);
      }
    }, 5000);
    return () => clearTimeout(timeout);
  }, [glReady]);

  const onCreated = useCallback(({ gl }: { gl: THREE.WebGLRenderer }) => {
    const ctx = gl.getContext();
    if (ctx) {
      ctx.finish();
    }
    setGlReady(true);
  }, []);

  const titleOpacity = interpolate(frame, [0, 25], [0, 1], { extrapolateRight: 'clamp' });
  const titleY = interpolate(frame, [0, 25], [-35, 0], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ backgroundColor }}>
      <Canvas
        camera={{
          position: cameraState.position,
          fov: 50,
          near: 0.1,
          far: 600
        }}
        style={{
          width: '100%',
          height: '100%',
          position: 'absolute',
          top: 0,
          left: 0,
          backgroundColor: backgroundColor, // Prevent white flash during init
        }}
        gl={{
          antialias: true,
          alpha: false,
          preserveDrawingBuffer: true,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          outputColorSpace: THREE.SRGBColorSpace,
        }}
        dpr={1}
        shadows="soft"
        frameloop="demand"
        onCreated={onCreated}
      >
        <TowerChartScene
          towers={towers}
          cameraPosition={cameraState.position}
          lookAt={cameraState.lookAt}
          visibleStart={visibleStart}
          visibleEnd={visibleEnd}
          currentIndex={currentIndex}
          introOpacity={introOpacity}
          revealProgress={revealProgress}
          totalItems={totalItems}
          showLabels3D={showLabels3D}
          showGround={showGround}
          groundColor={groundColor}
          backgroundColor={backgroundColor}
          ambientIntensity={ambientIntensity}
          backgroundPreset={backgroundPreset}
          customModelPath={customModelPath}
          customModelPosition={modelPos}
          customModelScale={customModelScale}
          customModelRotation={customModelRotation}
          towerSpacing={towerSpacing}
          labelVisibleEnd={labelVisibleEnd}
          frame={frame}
        />
      </Canvas>

      {/* Title Overlay */}
      <div
        style={{
          position: 'absolute',
          top: 35,
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
          pointerEvents: 'none',
          zIndex: 10,
        }}
      >
        <h1
          style={{
            fontSize: Math.min(48, width * 0.065),
            fontWeight: 900,
            color: '#FFFFFF',
            textShadow: '0 4px 25px rgba(0,0,0,0.7), 0 0 30px rgba(100,100,255,0.25)',
            margin: 0,
            letterSpacing: '-0.5px',
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            style={{
              fontSize: Math.min(20, width * 0.03),
              color: '#94A3B8',
              marginTop: 6,
            }}
          >
            {subtitle}
          </p>
        )}
      </div>

      {/* Progress dots */}
      <div
        style={{
          position: 'absolute',
          bottom: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: 6,
          opacity: titleOpacity * 0.7,
          zIndex: 10,
        }}
      >
        {(Array.isArray(items) ? items : []).slice(0, 10).map((_, i) => (
          <div
            key={i}
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              backgroundColor: frame > 40 + i * 18 ? gradientStart : '#333',
              boxShadow: frame > 40 + i * 18 ? `0 0 8px ${gradientStart}` : 'none',
            }}
          />
        ))}
      </div>
    </AbsoluteFill>
  );
}

export default TowerChart3DScene;