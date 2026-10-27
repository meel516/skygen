// ============================================================================
// BAR RACE 3D SCENE - Dynamic Horizontal Bar Race Visualization
// ============================================================================

import React, { useMemo, useEffect, useState, useRef } from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, delayRender, continueRender, cancelRender, spring } from 'remotion';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { Text, Box, Plane, Billboard, Stars } from '@react-three/drei';
import * as THREE from 'three';
import type { BarRace3DBlock, AnimationPhase } from '../schemas';
import type { MotionProfileType } from '../utils/animations';

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

// Easing function for smooth position transitions
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// ============================================================================
// 3D SCENE COMPONENTS
// ============================================================================

function StarField() {
  return (
    <Stars
      radius={150}
      depth={80}
      count={2000}
      factor={5}
      saturation={0.3}
      fade
      speed={0}
    />
  );
}

// ============================================================================
// RACING BAR COMPONENT
// ============================================================================

function RacingBar({ 
  yPosition, 
  barWidth, 
  barHeight, 
  barDepth, 
  color, 
  name, 
  value, 
  rank,
  image,
  showValueLabel,
  showNameLabel,
  showRankNumber,
  opacity,
  isWinner,
  targetX,
  currentX
}: {
  yPosition: number;
  barWidth: number;
  barHeight: number;
  barDepth: number;
  color: string;
  name: string;
  value: string;
  rank: number;
  image?: string;
  showValueLabel: boolean;
  showNameLabel: boolean;
  showRankNumber: boolean;
  opacity: number;
  isWinner: boolean;
  targetX: number;
  currentX: number;
}) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [loaded, setLoaded] = useState(!image);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!image) {
      setTexture(null);
      setLoaded(true);
      return;
    }

    const handle = delayRender('Loading bar texture: ' + image);
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

  // Calculate the X position based on currentX (animated position)
  const xPos = -barWidth / 2 + currentX;
  const labelX = -barWidth / 2 - 2;

  return (
    <group position={[xPos, yPosition, 0]}>
      {/* Main bar */}
      <Box args={[barWidth, barHeight, barDepth]} position={[barWidth / 2, 0, 0]}>
        <meshStandardMaterial 
          color={color} 
          metalness={0.6} 
          roughness={0.2}
          transparent={opacity < 1}
          opacity={opacity}
          emissive={color}
          emissiveIntensity={isWinner ? 0.5 : 0.15}
        />
      </Box>
      
      {/* Glow edge */}
      <Box args={[0.15, barHeight + 0.1, barDepth + 0.1]} position={[barWidth + 0.075, 0, 0]}>
        <meshBasicMaterial 
          color={color} 
          transparent 
          opacity={0.8 * opacity}
        />
      </Box>

      {/* Winner effect */}
      {isWinner && (
        <mesh position={[barWidth + 1, 0, 0]}>
          <sphereGeometry args={[0.5, 16, 16]} />
          <meshBasicMaterial color="#FFD700" />
        </mesh>
      )}

      {/* Image/Icon */}
      {image && texture && (
        <Billboard position={[-3, 0, barDepth / 2 + 0.5]} follow={true}>
          <mesh>
            <planeGeometry args={[barHeight * 0.8, barHeight * 0.8]} />
            <meshBasicMaterial map={texture} transparent opacity={opacity} side={THREE.DoubleSide} />
          </mesh>
        </Billboard>
      )}

      {/* Rank number */}
      {showRankNumber && (
        <Text
          position={[-barWidth / 2 - 4, 0, barDepth / 2 + 0.1]}
          fontSize={barHeight * 0.5}
          color={isWinner ? "#FFD700" : "#FFFFFF"}
          anchorX="right"
          anchorY="middle"
          fontWeight="bold"
          outlineWidth={0.04}
          outlineColor="#000000"
        >
          #{rank}
        </Text>
      )}

      {/* Name label */}
      {showNameLabel && (
        <Text
          position={[-barWidth / 2 - 5, 0, barDepth / 2 + 0.1]}
          fontSize={barHeight * 0.4}
          color="#FFFFFF"
          anchorX="left"
          anchorY="middle"
          fontWeight="bold"
          outlineWidth={0.03}
          outlineColor="#000000"
          maxWidth={10}
        >
          {name}
        </Text>
      )}

      {/* Value label */}
      {showValueLabel && (
        <Text
          position={[barWidth + 1.5, 0, barDepth / 2 + 0.1]}
          fontSize={barHeight * 0.45}
          color="#4ADE80"
          anchorX="left"
          anchorY="middle"
          fontWeight="bold"
          outlineWidth={0.03}
          outlineColor="#000000"
        >
          {value}
        </Text>
      )}
    </group>
  );
}

// ============================================================================
// BACKGROUND ENVIRONMENT
// ============================================================================

function BackgroundEnvironment({ preset, frame }: { preset: string; frame: number }) {
  switch (preset) {
    case 'cyber-grid':
      return <CyberGridEnvironment frame={frame} />;
    case 'neon-tokyo':
      return <NeonTokyoEnvironment frame={frame} />;
    case 'tron-grid':
      return <TronGridEnvironment frame={frame} />;
    case 'galaxy-nebula':
      return <GalaxyNebulaEnvironment />;
    case 'matrix-rain':
      return <MatrixRainEnvironment frame={frame} />;
    default:
      return null;
  }
}

function CyberGridEnvironment({ frame }: { frame: number }) {
  const gridLength = 200;
  const pulse = Math.sin(frame * 0.05) * 0.2 + 0.8;

  return (
    <group>
      <gridHelper args={[gridLength, 40, '#00ffff', '#0066ff']} position={[0, 0.05, 0]} />
      {/* Animated horizontal lines */}
      {[...Array(15)].map((_, i) => (
        <mesh key={i} position={[0, 0.02, -50 + i * 8]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[gridLength, 0.3]} />
          <meshBasicMaterial color="#00ffff" transparent opacity={0.4 * pulse} />
        </mesh>
      ))}
    </group>
  );
}

function NeonTokyoEnvironment({ frame }: { frame: number }) {
  return (
    <group>
      {/* Neon strips on floor */}
      {[...Array(10)].map((_, i) => (
        <mesh key={i} position={[0, 0.02, -40 + i * 10]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[100, 0.5]} />
          <meshBasicMaterial color={i % 2 === 0 ? "#ff00ff" : "#00ffff"} transparent opacity={0.6} />
        </mesh>
      ))}
      {/* Side neon towers */}
      {[-35, 35].map((x, side) => (
        [...Array(5)].map((_, i) => (
          <group key={`${side}-${i}`} position={[x, 10 + i * 8, -30 + i * 15]}>
            <mesh>
              <cylinderGeometry args={[0.3, 0.3, 15, 8]} />
              <meshBasicMaterial color={side === 0 ? "#ff00ff" : "#00ffff"} />
            </mesh>
          </group>
        ))
      ))}
    </group>
  );
}

function TronGridEnvironment({ frame }: { frame: number }) {
  const pulse = Math.sin(frame * 0.1) * 0.3 + 0.7;

  return (
    <group>
      <gridHelper args={[200, 50, '#00ffff', '#004444']} position={[0, 0.05, 0]} />
      {/* Vertical light beams */}
      {[-40, -20, 0, 20, 40].map((x, i) => (
        <mesh key={i} position={[x, 15, 0]}>
          <boxGeometry args={[0.2, 30, 0.2]} />
          <meshBasicMaterial color="#00ffff" transparent opacity={0.6 * pulse} />
        </mesh>
      ))}
    </group>
  );
}

function GalaxyNebulaEnvironment() {
  const random = seededRandom(42);

  return (
    <group position={[0, 20, 0]}>
      {/* Nebula clouds */}
      {[...Array(12)].map((_, i) => (
        <mesh 
          key={i} 
          position={[
            (random() - 0.5) * 100, 
            (random() - 0.5) * 40, 
            (random() - 0.5) * 80
          ]}
        >
          <sphereGeometry args={[8 + random() * 12, 16, 16]} />
          <meshBasicMaterial 
            color={`hsl(${200 + random() * 100}, 70%, 40%)`} 
            transparent 
            opacity={0.15} 
          />
        </mesh>
      ))}
      {/* Stars */}
      {[...Array(50)].map((_, i) => (
        <mesh key={`star-${i}`} position={[
          (random() - 0.5) * 120,
          (random() - 0.5) * 60,
          (random() - 0.5) * 100
        ]}>
          <sphereGeometry args={[0.2, 4, 4]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      ))}
    </group>
  );
}

function MatrixRainEnvironment({ frame }: { frame: number }) {
  const rainCount = 60;
  const random = seededRandom(123);

  return (
    <group position={[0, 25, 0]}>
      {[...Array(rainCount)].map((_, i) => (
        <mesh 
          key={i} 
          position={[
            -60 + (i % 20) * 6, 
            ((frame * 2 + i * 5) % 60) - 30, 
            (random() - 0.5) * 50
          ]}
        >
          <boxGeometry args={[0.4, 6 + random() * 10, 0.1]} />
          <meshBasicMaterial 
            color="#00ff00" 
            transparent 
            opacity={0.3 + random() * 0.4} 
          />
        </mesh>
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
// MAIN SCENE COMPONENT
// ============================================================================

function BarRaceScene({
  items,
  cameraPosition,
  lookAt,
  barHeight,
  barMaxWidth,
  barSpacing,
  barDepth,
  gradientStart,
  gradientEnd,
  useGradientByValue,
  showValueLabels,
  showNameLabels,
  showRankNumbers,
  backgroundColor,
  groundColor,
  showGround,
  ambientIntensity,
  backgroundPreset,
  raceProgress,
  maxValue,
  showWinnerEffect,
}: {
  items: Array<{
    name: string;
    value: number;
    valueFormatted?: string;
    color?: string;
    image?: string;
    targetY: number;
    currentY: number;
    barWidth: number;
    rank: number;
  }>;
  cameraPosition: [number, number, number];
  lookAt: [number, number, number];
  barHeight: number;
  barMaxWidth: number;
  barSpacing: number;
  barDepth: number;
  gradientStart: string;
  gradientEnd: string;
  useGradientByValue: boolean;
  showValueLabels: boolean;
  showNameLabels: boolean;
  showRankNumbers: boolean;
  backgroundColor: string;
  groundColor: string;
  showGround: boolean;
  ambientIntensity: number;
  backgroundPreset: string;
  raceProgress: number;
  maxValue: number;
  showWinnerEffect: boolean;
}) {
  const frame = useCurrentFrame();

  return (
    <>
      <color attach="background" args={[backgroundColor]} />
      <fog attach="fog" args={[backgroundColor, 30, 150]} />
      
      <StarField />
      
      <BackgroundEnvironment preset={backgroundPreset} frame={frame} />
      
      <ambientLight intensity={ambientIntensity} />
      <directionalLight position={[30, 50, 30]} intensity={1.2} />
      <directionalLight position={[-20, 30, -20]} intensity={0.4} color="#6666ff" />
      <pointLight position={[0, 30, 0]} intensity={0.5} />
      <hemisphereLight args={['#5555aa', '#222233', 0.3]} />
      
      {showGround && (
        <Plane args={[200, 100]} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
          <meshStandardMaterial color={groundColor} metalness={0.4} roughness={0.6} />
        </Plane>
      )}
      
      <SynchronizedCamera cameraPosition={cameraPosition} lookAt={lookAt} />
      
      {items.map((item, index) => {
        const color = item.color || (useGradientByValue 
          ? lerpColor(gradientEnd, gradientStart, item.value / maxValue)
          : gradientStart);
        
        const isWinner = raceProgress >= 1 && index === 0;

        return (
          <RacingBar
            key={item.name}
            yPosition={item.currentY}
            barWidth={item.barWidth}
            barHeight={barHeight}
            barDepth={barDepth}
            color={color}
            name={item.name}
            value={item.valueFormatted || formatValue(item.value)}
            rank={item.rank}
            image={item.image}
            showValueLabel={showValueLabels}
            showNameLabel={showNameLabels}
            showRankNumber={showRankNumbers}
            opacity={1}
            isWinner={isWinner && showWinnerEffect}
            targetX={0}
            currentX={0}
          />
        );
      })}
    </>
  );
}

// ============================================================================
// CALCULATE BARS
// ============================================================================

function calculateBars(
  items: BarRace3DBlock['items'],
  frame: number,
  fps: number,
  raceDuration: number,
  barHeight: number,
  barMaxWidth: number,
  barSpacing: number,
  positionTransitionSpeed: number,
  valueGrowSpeed: number
) {
  if (!items || items.length === 0) return { bars: [], maxValue: 0, raceProgress: 0 };

  // Calculate race progress (0 to 1 over raceDuration)
  const totalFrames = raceDuration * fps;
  const raceProgress = Math.min(1, frame / totalFrames);

  // Sort by value to determine ranks
  const sorted = [...items].sort((a, b) => b.value - a.value);
  
  // Find max value for bar scaling
  const maxValue = Math.max(...items.map(i => i.value), 1);

  // Calculate animated values (grow over time)
  const animatedItems = items.map((item) => {
    // Each item has its own growth animation
    const targetValue = item.value;
    const startValue = targetValue * 0.1; // Start at 10% of target
    const animatedValue = startValue + (targetValue - startValue) * easeOutCubic(raceProgress);
    
    return {
      ...item,
      animatedValue,
      targetValue,
    };
  });

  // Re-sort by animated values to get current rankings
  const currentSorted = [...animatedItems].sort((a, b) => b.animatedValue - a.animatedValue);

  // Calculate positions based on current ranking
  const bars = currentSorted.map((item, index) => {
    const targetY = -((index - (currentSorted.length - 1) / 2) * barSpacing);
    const barWidth = (item.animatedValue / maxValue) * barMaxWidth;
    const rank = index + 1;

    return {
      ...item,
      targetY,
      currentY: targetY, // Will be animated separately
      barWidth,
      rank,
    };
  });

  return { bars, maxValue, raceProgress };
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export interface BarRace3DSceneProps {
  data: BarRace3DBlock;
  theme?: string;
  motionProfile?: MotionProfileType;
  animation?: AnimationPhase;
}

export function BarRace3DScene({ data }: BarRace3DSceneProps): React.ReactElement {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const handleRef = useRef<number | null>(null);
  const [glReady, setGlReady] = useState(false);

  // Initialize delayRender handle on mount
  useEffect(() => {
    handleRef.current = delayRender('Initializing Bar Race 3D scene');
    return () => {
      if (handleRef.current !== null) {
        cancelRender(handleRef.current);
      }
    };
  }, []);

  const {
    title = 'Bar Race',
    subtitle,
    items = [],
    raceDuration = 10,
    barHeight = 2.5,
    barMaxWidth = 30,
    barSpacing = 3.5,
    barDepth = 2,
    gradientStart = '#3B82F6',
    gradientEnd = '#8B5CF6',
    useGradientByValue = true,
    showValueLabels = true,
    showNameLabels = true,
    showRankNumbers = true,
    cameraDistance = 35,
    cameraAngle = 30,
    backgroundColor = '#0a0a1a',
    groundColor = '#151525',
    showGround = true,
    ambientIntensity = 0.6,
    backgroundPreset = 'cyber-grid',
    showWinnerEffect = true,
    positionTransitionSpeed = 0.3,
    valueGrowSpeed = 1,
  } = data;

  // Calculate bar positions and values
  const { bars, maxValue, raceProgress } = useMemo(() => {
    return calculateBars(
      items,
      frame,
      fps,
      raceDuration,
      barHeight,
      barMaxWidth,
      barSpacing,
      positionTransitionSpeed,
      valueGrowSpeed
    );
  }, [items, frame, fps, raceDuration, barHeight, barMaxWidth, barSpacing, positionTransitionSpeed, valueGrowSpeed]);

  // Camera position - view from above and to the side for better horizontal bar visibility
  const cameraAngleRad = (cameraAngle * Math.PI) / 180;
  const cameraPosition: [number, number, number] = [
    Math.sin(cameraAngleRad) * cameraDistance * 0.5,
    cameraDistance * 0.8, // Higher camera position
    Math.cos(cameraAngleRad) * cameraDistance
  ];
  const lookAt: [number, number, number] = [barMaxWidth / 3, 0, 0];

  useEffect(() => {
    if (handleRef.current !== null) {
      continueRender(handleRef.current);
      handleRef.current = null;
    }
    setGlReady(true);
  }, []);

  if (!glReady) return <></>;

  return (
    <AbsoluteFill style={{ backgroundColor }}>
      <Canvas
        gl={{ 
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
        }}
        camera={{ position: cameraPosition, fov: 45, near: 0.1, far: 500 }}
        dpr={[1, 2]}
        frameloop="demand"
      >
        <BarRaceScene
          items={bars}
          cameraPosition={cameraPosition}
          lookAt={lookAt}
          barHeight={barHeight}
          barMaxWidth={barMaxWidth}
          barSpacing={barSpacing}
          barDepth={barDepth}
          gradientStart={gradientStart}
          gradientEnd={gradientEnd}
          useGradientByValue={useGradientByValue}
          showValueLabels={showValueLabels}
          showNameLabels={showNameLabels}
          showRankNumbers={showRankNumbers}
          backgroundColor={backgroundColor}
          groundColor={groundColor}
          showGround={showGround}
          ambientIntensity={ambientIntensity}
          backgroundPreset={backgroundPreset}
          raceProgress={raceProgress}
          maxValue={maxValue}
          showWinnerEffect={showWinnerEffect}
        />
      </Canvas>
    </AbsoluteFill>
  );
}

export default BarRace3DScene;
