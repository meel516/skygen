// Remotion official skills reference — injected into all plugin specialist agents.
// Source: https://github.com/remotion-dev/skills

export const REMOTION_SKILLS = `
## REMOTION REFERENCE (Official Skills)

### Core: Motion-graphics timing model (Skygen)

Host props \`animation.enter/hold/exit\` only define **total duration**. Creative timing is a **frame score**:
- totalFrames = (enter+hold+exit)*fps  (or schema defaults.durationSec * fps)
- Named beats: open → hook → build → climax → resolve
- Per-layer delays: \`spring({ frame: Math.max(0, frame - startFrame), fps, config })\`
- Multi-keyframe moves: \`interpolate(frame, [0, a, b, total], [...])\`
- Sustain ALWAYS ON: breath / drift / pulse for the full duration
- FORBIDDEN: single global fade for enter/hold/exit (widget quality)

### Core: Timing & Interpolation

\`interpolate(frame, inputRange, outputRange, options)\` maps a frame number to a value.
- Always clamp: \`{ extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }\`
- Use \`Easing.out\` for impact landings (starts fast, decelerates into place)
- Use \`Easing.in\` for resolve-outs
- Bézier easing: \`Easing.bezier(x1, y1, x2, y2)\` — matches CSS cubic-bezier syntax
  - Crisp UI entrance: \`Easing.bezier(0.22, 1, 0.36, 1)\`
  - Editorial fade: \`Easing.bezier(0.45, 0, 0.55, 1)\`
  - Playful overshoot: \`Easing.bezier(0.34, 1.56, 0.64, 1)\`
- Named presets: \`Easing.quad\`, \`Easing.cubic\`, \`Easing.sin\`, \`Easing.exp\`, \`Easing.circle\`
  combined with \`.in\`, \`.out\`, \`.inOut\`
- Derive multiple animated properties from a SINGLE normalized progress (0→1):
  \`\`\`ts
  const progress = interpolate(frame, [start, start + dur], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const opacity = progress;
  const scale = interpolate(progress, [0, 1], [0.8, 1]);
  \`\`\`
- **Multi-Stage Keyframing**: You can pass more than two waypoints to create complex continuous movement without nesting Sequences.
  \`\`\`ts
  // Pans a camera across a large canvas across multiple beats
  const camX = interpolate(frame, [0, 30, 60, 90, 120], [0, -100, -100, -250, -250], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic) });
  \`\`\`

### Core: Organic Motion (@remotion/noise)

\`noise2D(seed, x, y)\` and \`noise3D(seed, x, y, z)\` from \`@remotion/noise\` generate smooth, deterministic random values (-1 to 1).
- **Subtle Camera Shake**: \`const shakeX = noise2D("cam-x", frame * 0.008, 0) * 3;\`
- **Floating Particles**: \`const driftY = noise2D("drift", i * 8, frame * 0.012) * 15;\`
- ALWAYS prefer \`noise2D\` over \`Math.sin()\` for organic drift, as it feels more natural and less mechanical.

\`spring({ frame, fps, config })\` — bouncy physics animation.
- Returns 0→1 (approximately). Config: \`{ stiffness: 80–200, damping: 15–25 }\`
- Higher stiffness = faster/snappier. Higher damping = less bounce.
- Use for enter animations that need a natural overshoot feel.

### Core: Sequencing

\`<Sequence from={N} durationInFrames={N}>\` — delays and limits child visibility.
- Inside a Sequence, \`useCurrentFrame()\` counts from 0 (local time, not global).
- \`layout="none"\` to avoid wrapping in AbsoluteFill.
- \`premountFor={N}\` — preloads component N frames before it appears.
- Nesting: inner Sequence trims start, outer Sequence adds delay.
  \`\`\`tsx
  <Sequence from={30}> // delay 30 frames
    <Sequence from={-15}> // trim first 15 frames of animation
      <MyComponent />
    </Sequence>
  </Sequence>
  \`\`\`

\`<Series>\` — arranges children sequentially without overlap.
- Children use \`<Series.Sequence durationInFrames={N}>\`
- Negative \`offset\` creates overlaps between sequences.

Stagger multi-element entries:
\`\`\`ts
const opacity = interpolate(frame, [i * 5, enterFrames + i * 5], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
\`\`\`

### Images

\`<Img src={url} style={...} />\` — Remotion's image component (use instead of <img>).
- Blocks rendering until loaded (important for Lambda render accuracy).
- \`objectFit: 'cover' | 'contain' | 'fill'\`
- For frame-by-frame sequences: \`<Img src={staticFile(\`frames/frame\${frame}.png\`)}\` />\`
- Get dimensions: \`getImageDimensions(url)\` returns \`{ width, height }\`

### Videos

\`<Video src={url} style={...} />\` — frame-accurate video (use instead of <video>).
- \`trimBefore={N}\` / \`trimAfter={N}\` — trim frames from start/end.
- \`playbackRate={2}\` — speed (no reverse).
- \`loop\` — infinite loop.
- \`muted\` — silence.
- \`volume={0.5}\` or volume callback: \`volume={(f) => interpolate(f, [0, 30], [0, 1])}\`
- Wrap in \`<Sequence from={30}>\` to delay start.

### Audio

\`<Audio src={url} />\` — synced audio.
- Same \`trimBefore\`, \`trimAfter\`, \`playbackRate\`, \`loop\`, \`muted\`, \`volume\` as Video.
- Wrap in \`<Sequence>\` to delay.

### Transitions (TransitionSeries)

\`<TransitionSeries>\` from \`@remotion/transitions\` — manages scene transitions.
- Built-in presentations: \`fade()\`, \`slide()\`, \`wipe()\`, \`flip()\`, \`clockWipe()\`
- Timing: \`linearTiming({ durationInFrames })\` (smooth cinematic) or \`springTiming({ config: { damping: 200 } })\` (snappy physical entrances)
- Transitions OVERLAP adjacent scenes → total duration is SHORTER than sum of parts.
  Example: two 60-frame scenes + 15-frame transition = 105 total frames.
- **Cinematic Overlays**: Use \`<TransitionSeries.Overlay durationInFrames={30}>\` with \`<LightLeak seed={3} hueShift={50} />\` from \`@remotion/light-leaks\` to create premium, high-end studio transitions between scenes.
\`\`\`tsx
import { LightLeak } from "@remotion/light-leaks";
<TransitionSeries>
  <TransitionSeries.Sequence durationInFrames={60}><SceneA /></TransitionSeries.Sequence>
  <TransitionSeries.Overlay durationInFrames={30}><LightLeak seed={3} hueShift={50} /></TransitionSeries.Overlay>
  <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 15 })} />
  <TransitionSeries.Sequence durationInFrames={60}><SceneB /></TransitionSeries.Sequence>
</TransitionSeries>
\`\`\`

### Text Animations

Typewriter effect — always use string slicing, NEVER per-character opacity:
\`\`\`ts
const charsToShow = Math.floor(interpolate(frame, [0, enterFrames], [0, text.length], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }));
const visible = text.slice(0, charsToShow);
\`\`\`

Word highlight — interpolate background-color or opacity per word based on frame position.

### Fonts

Google Fonts (recommended — type-safe, auto-blocks render):
\`\`\`ts
import { loadFont } from '@remotion/google-fonts/Inter';
const { fontFamily } = loadFont();
// use fontFamily in style={{ fontFamily }}
\`\`\`
Call \`loadFont()\` at module level (top of file), not inside component.
Specify weights/subsets for smaller bundles: \`loadFont('normal', { subsets: ['latin'], weights: ['400', '700'] })\`

Local fonts (from public/ folder):
\`\`\`ts
import { loadFont } from '@remotion/fonts';
await loadFont({ family: 'MyFont', url: staticFile('MyFont.woff2'), weight: '400' });
\`\`\`

### Measuring Text

\`measureText({ text, fontFamily, fontSize, fontWeight })\` from \`@remotion/layout-utils\`
- Results are cached — safe to call repeatedly.
- Load font BEFORE measuring.
- Use \`validateFontIsLoaded: true\` to catch font loading issues.
- Use \`outline\` instead of \`border\` to avoid layout differences.

\`fitText({ text, withinWidth, fontFamily, fontWeight })\` — find optimal font size for a container.

### Measuring DOM Nodes

Remotion applies a \`scale()\` transform — \`getBoundingClientRect()\` values are scaled.
Fix:
\`\`\`ts
import { useCurrentScale } from 'remotion';
const scale = useCurrentScale();
const rect = ref.current.getBoundingClientRect();
const realWidth = rect.width / scale;
const realHeight = rect.height / scale;
\`\`\`

### GIFs / Animated Images

\`<AnimatedImage src={url} width={N} height={N} />\` from \`@remotion/gif\`
- \`fit\`: 'fill' | 'contain' | 'cover'
- \`playbackRate\`: speed multiplier
- \`loop\`: 'loop' | 'pause-after-finish' | 'clear-after-finish'
- Get duration: \`getGifDurationInSeconds(url)\`

### Audio Visualization

\`useWindowedAudioData({ src, frame, fps, windowDurationInSeconds })\` from \`@remotion/media-utils\`

Spectrum bars:
\`\`\`ts
const data = useWindowedAudioData({ src: staticFile('audio.mp3'), frame, fps, windowDurationInSeconds: 1 });
const bars = visualizeAudio({ fps, frame, audioData: data, numberOfSamples: 64 }); // powers of 2: 32-1024
// bars[i] is 0-1, lower indices = bass frequencies
\`\`\`

Waveform: \`visualizeAudioWaveform()\` + \`createSmoothSvgPath()\`

Bass reactivity:
\`\`\`ts
const bassValues = bars.slice(0, 4);
const bassIntensity = bassValues.reduce((a, b) => a + b, 0) / bassValues.length;
\`\`\`

Pass \`frame\` as a prop to child components — don't call \`useCurrentFrame()\` separately inside them.
Sample counts MUST be powers of 2. Apply logarithmic scaling to low frequencies for balanced visuals.

### Lottie

\`\`\`ts
import Lottie from 'lottie-react'; // declare in deps
const lottieRef = useRef(null);
useEffect(() => { lottieRef.current?.goToAndStop(frame, true); }, [frame]);
<Lottie lottieRef={lottieRef} animationData={lottieJson} loop autoplay={false} />
\`\`\`
- \`animationData\` MUST be a JS object (never a URL string). Embed minimal inline JSON if no file provided.
- Sync to Remotion frame via \`goToAndStop(frame, true)\` inside useEffect.

### 3D (React Three Fiber)

\`\`\`ts
import { Canvas, useFrame } from '@react-three/fiber'; // declare in deps
import { Text, Box, Sphere, Cylinder, OrbitControls } from '@react-three/drei'; // declare in deps
\`\`\`
- MUST wrap in \`<ThreeCanvas width={width} height={height}>\` from \`@remotion/three\` OR plain \`<Canvas>\` at 100%×100%.
- Animations MUST be driven by \`useCurrentFrame()\`. Using \`useFrame\` alone causes flicker during rendering.
- Pass frame as prop into Canvas children, read inside useFrame:
  \`\`\`tsx
  function Mesh({ syncFrame }: { syncFrame: number }) {
    const ref = useRef<THREE.Mesh>(null);
    useFrame(() => { if (ref.current) ref.current.rotation.y = syncFrame * 0.02; });
    return <mesh ref={ref}><boxGeometry /><meshStandardMaterial /></mesh>;
  }
  // Inside Scene:
  const frame = useCurrentFrame();
  <Canvas><ambientLight /><directionalLight position={[10,10,5]} /><Mesh syncFrame={frame} /></Canvas>
  \`\`\`
- \`<Sequence layout="none">\` inside ThreeCanvas.
- Primitives only: Box, Sphere, Cylinder, Torus, Text. No GLTF/GLB.

### Maps (MapLibre GL JS + Turf)

Use MapLibre for deterministic map animations: route reveals, flight paths, markers, labels, and camera movement.

\`\`\`ts
import maplibregl, { type GeoJSONSource, type Map } from 'maplibre-gl'; // declare in deps
import * as turf from '@turf/turf'; // declare in deps
import 'maplibre-gl/dist/maplibre-gl.css';
\`\`\`

- Dependencies: \`maplibre-gl\` and \`@turf/turf\`. Do NOT install \`@types/maplibre-gl\`; MapLibre ships types.
- Coordinates are always \`[longitude, latitude]\`.
- **SCHEMA CUSTOMIZATION**: Ensure the map is highly customizable via \`schema.json\`. Users MUST be able to define the region (e.g., center \`latitude\`, \`longitude\`) and borders/routes (e.g., arrays of points) through plugin properties. Do NOT hardcode regions.
- Use GeoJSON sources + MapLibre layers for lines, markers, and labels. Avoid DOM Marker elements unless explicitly requested.
- For geodesic flight routes, use Turf \`greatCircle()\`, \`length()\`, \`along()\`, and \`lineSliceAlong()\`; keep slices non-empty with \`Math.max(0.001, distance * progress)\`.
- For visually straight map lines, use a simple GeoJSON \`LineString\` between points instead of \`greatCircle()\`.
- For camera motion, prefer \`map.calculateCameraOptionsFromTo(cameraLngLat, cameraAltitudeMeters, targetLngLat)\`.
- Separate \`targetRoute\` from \`cameraRoute\`; animate travel progress separately from camera altitude for zoom-out / travel / zoom-in motion.
- Per frame: update the GeoJSON source with \`source.setData(...)\`, call \`map.jumpTo(...)\`, wait for \`idle\`, then \`continueRender(handle)\`; call \`map.triggerRepaint()\` if camera values may be unchanged.
- Marker dots and labels should be map-native layers; make label sizes large enough for video resolution.
- Rendering WebGL maps should use single concurrency and ANGLE: \`remotion render --gl=angle --concurrency=1\`.

### Transparent Video Export

ProRes (for video editing software):
- imageFormat: png, pixelFormat: yuva444p10le, codec: prores, profile: 4444

WebM/VP9 (for browser):
- imageFormat: png, pixelFormat: yuva420p, codec: vp9

### calculateMetadata (dynamic composition config)

\`\`\`ts
export const calculateMetadata: CalculateMetadataFunction<Props> = async ({ props, abortSignal }) => {
  const duration = await getVideoDuration(props.videoSrc);
  return { durationInFrames: Math.round(duration * props.fps), props };
};
\`\`\`
Returns any of: durationInFrames, width, height, fps, props, defaultOutName, defaultCodec.

### Advanced Cinematic Patterns (CRITICAL FOR PREMIUM PLUGINS)

When building plugins, you MUST use these premium patterns instead of basic implementations:

1. **High-End Procedural Backgrounds**:
   - FORBIDDEN: Plain solid color backgrounds.
   - REQUIRED: Use CSS \`radial-gradient\` mapped to \`Math.sin/cos\` driven by \`useCurrentFrame()\` to create floating "Aurora" color blobs. Or use lightweight absolute-positioned elements drifting with \`noise2D\` to create particle fields.

2. **Kinetic Typography (Staggered Reveals)**:
   - FORBIDDEN: Fading in whole text blocks at once.
   - REQUIRED: Split text into characters or words (using \`map\`). Use \`spring()\` with a stagger delay: \`frame: Math.max(0, frame - i * stagger)\`.
   - Interpolate \`translateY\`, \`scale\`, and \`filter: blur()\` simultaneously on each word for premium, Apple-style text reveals.

3. **Infinite Canvas / Camera Pan (Creativly FlowDemo pattern — REQUIRED for multi-node / explainer scenes)**:
   - Create a massive canvas \`div\` (e.g. **2400×1400**) inside \`AbsoluteFill\`, centered with \`left/top: 50%\` and \`transformOrigin: "center center"\`.
   - Place all nodes/UI absolutely on that canvas (not on the viewport).
   - Drive camera with multi-keyframe \`interpolate\` + \`Easing.inOut(Easing.cubic)\` on **camScale, camX, camY** together (same frame stops for all three).
   - **Creativly pull-back recipe** (tight on first element → reveal full board):
     - frames: \`[0, 20, 55, 90, 125, 165]\`
     - camScale: \`[1.45, 1.25, 1.0, 0.88, 0.78, 0.75]\` (start zoomed-in, dolly out)
     - camX / camY: multi-stage pans that track the narrative (e.g. start offset on first node, end centered on full pipeline)
   - Apply: \`transform: \\\`translate(calc(-50% + \${camX + shakeX}px), calc(-50% + \${camY + shakeY}px)) scale(\${camScale})\\\`\`
   - **Handheld**: \`shakeX = noise2D("cam-sx", frame * 0.008, 0) * 3\`, \`shakeY = noise2D("cam-sy", 0, frame * 0.008) * 2\` (subtle — never > ~4px unless intentional chaos)
   - Optional **mini-map viewport** (#41): rect size inversely tracks camScale so zoom context is readable.

4. **2.5D Browser Mockups**:
   - For UI showcases, wrap images in a macOS-style browser frame (top bar with 3 dots).
   - Apply 3D CSS transforms: \`perspective: 1000px\`, \`rotateX\`, and \`rotateY\` to make them float in 3D space.

5. **Node/Workflow Diagrams**:
   - Draw data flows using SVG cubic bezier paths (\`<path d="M... C...">\`) to connect nodes.
   - Animate data flowing between them using \`strokeDasharray\` and animating \`strokeDashoffset\` with \`useCurrentFrame()\`.

6. **Animated Data Counters & Progress**:
   - FORBIDDEN: Static numbers for stats or data.
   - REQUIRED: Use \`Math.floor(interpolate(progress, [0, 1], [0, targetValue]))\` to animate numbers ticking up.
   - REQUIRED: Animate SVG lines/charts using \`evolvePath\` from \`@remotion/paths\` over time.

7. **Staggered 3D Cards Grid**:
   - When showing a grid of elements (like templates, photos, or features), use \`perspective(800px) rotateX(\${tiltX}deg) rotateY(\${tiltY}deg)\`.
   - Stagger the entrance of each card with \`delay = i * 5\` and calculate tilt directions based on their row/column position to give the grid depth.

8. **Audio / Data Waveforms**:
   - For audio or data plugins, create an array of bars \`<divs>\` where height is driven by \`Math.sin()\` and \`noise2D()\`.
   - Apply a floor reflection by duplicating the bars upside down with \`transform: scaleY(-1)\` and fading them out using \`maskImage: "linear-gradient(to bottom, rgba(0,0,0,0.15), transparent)"\`.

9. **3D Exploding UI Layers**:
   - When showcasing a dashboard or editor UI, wrap the layers in a container with \`transformStyle: "preserve-3d"\` and \`rotateX("15deg")\`.
   - Place different pieces of the UI in separate child layers, and animate their \`translateZ\` values to "explode" them apart along the Z-axis, creating a cinematic depth effect.

10. **Multiplayer / Collaboration Cursors**:
   - When showing real-time collaboration, draw SVG cursors and animate their x/y positions using \`spring\`.
   - REQUIRED: Add organic wobble to the cursor paths using \`noise2D\`.
   - REQUIRED: Draw curved SVG connecting paths between cursors using \`evolvePath\` to show team connectivity.

11. **Before / After Scanlines (AI Processing)**:
   - When showing an AI feature (like inpainting, upscaling, or editing), use a sweeping scanline \`<div>\`.
   - REQUIRED: Use \`clipPath: "polygon(...)"\` to separate the "before" state (e.g. with \`backdropFilter: "grayscale(100%) blur(10px)"\`) from the "after" state.
   - Attach small \`@remotion/shapes\` stars that follow the scanline and drift dynamically using \`noise2D\`.

12. **Node-Based Workflows (Pipelines & Graphs)**:
   - When showing a pipeline or workflow, render distinct Node components and connect them using curved SVG \`<path>\` edges (animating with \`evolvePath\`).
   - REQUIRED: Animate a cinematic camera panning and zooming across the nodes using \`interpolate\` on a parent container's \`scale\` and \`translate\`.

13. **Typewriter Text with Evolving Indicator**:
   - When showing AI generating text, use a \`<Typewriter>\` component.
   - REQUIRED: Alongside the text, animate a vertical line drawing down using \`evolvePath\`, accompanied by a blurred gradient glow block that acts as a highlighted cursor.

14. **Floating Camera / Recorder Overlays**:
   - When showing screen recording, presentations, or video calls, place a floating "Camera Overlay" box in the bottom right (with heavy rounded borders, \`overflow: hidden\`, and colored shadows).
   - Add a blinking "REC" indicator animated via \`Math.sin()\` and wrap it in a circular \`evolvePath\` ring.

15. **Card Shimmer Sweep**:
   - On cards and panels, animate a diagonal light sweep: \`background: "linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.2) 50%, transparent 70%)"\`.
   - Animate \`transform: translateX(\${shimmerX}%)\` from -120% to 220% over ~35 frames to make cards feel premium and tactile.

16. **Dual Ghost Watermark Depth**:
   - For background depth, render two copies of a large italic watermark word stacked on top of each other.
   - First copy is at normal opacity (e.g. 0.06), second copy is offset slightly (e.g. \`top: "48%", left: "51%"\`) at 40% of the first copy's opacity, creating a parallax depth effect.

17. **Matrix Rain Background**:
   - When showing a "code", "open source", or "developer" scene, use a \`<MatrixRain>\` component with a dot grid (\`backgroundImage: "radial-gradient(#color 1px, transparent 1px)"\`) overlay.
   - Set the Matrix Rain to a very low opacity (e.g. 0.12) so it's a subtle, atmospheric background effect.

18. **Aurora Background with Breathing Glow**:
   - For outro or hero scenes, use an \`<AuroraBackground>\` component behind everything, then layer a \`radial-gradient\` centered glow on top of it.
   - Animate the glow's \`scale\` property using \`noise2D\` to make it "breathe" organically: \`scale(\${0.6 + 0.15 * noise2D("breathe", frame * 0.02, 0)})\`.

19. **Interactive Before/After Comparison Slider**:
   - For image editing, enhancement, or preset comparisons, overlay the "Before" state using \`clipPath: polygon(0 0, \${sliderPos}% 0, \${sliderPos}% 100%, 0 100%)\` over the "After" state.
   - Draw a physical white vertical divider line at \`left: \${sliderPos}%\` with a custom floating drag handle container containing grip dots.

20. **Horizontal Speed Line Warp**:
   - To show high speed or performance, render an array of horizontal lines that move across the screen.
   - Calculate their position using frame-based modulo: \`left: ((frame * speed + offset) % (width + margin)) - margin\`. Blend their widths dynamically using \`noise2D\`.

21. **Decaying Screen Shake**:
   - During high-impact transitions or speed bursts, add camera shake to the parent container using \`noise2D("shake", frame * frequency, 0) * intensity\`.
   - REQUIRED: Multiply the shake by a decaying factor (e.g., \`1 - progress\`) so it starts intense and organically settles to zero.

22. **Connection Handles with State Glow**:
   - For node-based workflows, render precise circular connection handles at the left and right edges: \`position: absolute, left/right: -6, top: "50%", transform: "translateY(-50%)", width: 12, height: 12, borderRadius: "50%"\`.
   - Modulate their border glow colors based on active signals using \`handleGlow\` props: \`boxShadow: handleGlow > 0 ? 0 0 \${12 * handleGlow}px \${color} : none\`.

23. **Scanning Progress Tints**:
   - During a progress sweep, render a semi-transparent colored tint behind the sweep line covering only the completed portion: \`position: absolute, top: 0, left: 0, width: \${scanLinePos}%, background: \${color}08, zIndex: 4\`.

24. **Contextual Slide-Out Action Docks**:
   - When elements are selected or focused, slide out a contextual glass action toolbar from behind the element: \`position: absolute, right: -52, top: "50%", transform: translateY(-50%) translateX(\${10 * (1 - actionDockOpacity)}px)\`.
   - Coordinate the dock's opacity and position to animate in perfect sync using spring values.

25. **Transition Series Sequence Orchestration**:
   - For multi-scene layouts, coordinate scenes using \`<TransitionSeries>\` from \`@remotion/transitions\` with standard transitions (\`wipe\`, \`slide\`, \`fade\`, \`flip\`).
   - Use spring timings like \`springTiming({ config: { damping: 200 } })\` for smooth, satisfying cuts.

26. **Organic Light Leak Transitions**:
   - When moving between major sections, layer a \`<TransitionSeries.Overlay>\` containing a \`<LightLeak>\` from \`@remotion/light-leaks\` (e.g., \`<LightLeak seed={3} hueShift={50} />\`) to make scene cuts feel natural, warm, and professional.

27. **Highlighter Text Reveals**:
   - Emphasize key text by rendering a background highlight container: \`position: absolute, left/right: -6, zIndex: -1, transformOrigin: "left center"\`.
   - Draw the highlight left-to-right using \`transform: scaleX(\${progress}) skewX(\${skew}deg)\` triggered by text timing.

28. **Outline & Micro-Drift Typography**:
   - Support outline styles for large, modern headlines: \`WebkitTextStroke: "2px color", color: "transparent"\`.
   - Apply a micro-noise drift (\`noise2D\`) to active typography elements to keep them moving subtly.

29. **Premium Easing Curves (Cinematic & Elastic)**:
   - For premium transitions, avoid browser default or generic easings.
   - REQUIRED: Use custom bezier easings: \`Easing.bezier(0.22, 1, 0.36, 1)\` for a smooth cinematic ramp, or \`Easing.bezier(0.1, 0.9, 0.2, 1)\` for a soft elastic spring-like curve.

30. **Blur-to-Sharp Rack Focus Entrance (Creativly FocusedDemo pattern)**:
   - Elements SHOULD enter with gaussian blur resolving to sharp: combine **spring entrance** with:
     - \`heroScale = interpolate(spr, [0, 1], [1.12, 1])\` (or 1.8→1 for punchier hero)
     - \`heroBlur = interpolate(spr, [0, 1], [14, 0])\` (or start ~20 for deeper rack)
   - Apply: \`transform: scale(\${heroScale})\` + \`filter: heroBlur > 0.5 ? \\\`blur(\${heroBlur}px)\\\` : undefined\`
   - REQUIRED: drop filter when blur ≤ 0.5 (perf). Pair with soft shadow/border so the “lens pop” reads.
   - Mimics camera rack-focus — far more cinematic than opacity-only fades.

31. **Spring-Gated Noise (Critical Polish)**:
   - When elements have post-entrance noise drift, ALWAYS multiply noise by the entrance spring value: \`noise2D("badge-\${i}", frame * 0.02, i) * 3 * entranceSpr\`.
   - At \`entranceSpr = 0\` (not yet entered), noise has zero effect. At \`entranceSpr = 1\` (fully entered), noise is at full amplitude.
   - This prevents the visual glitch of items visibly drifting before their entrance animation completes.

32. **Sparkle Burst at Completion**:
   - When a result appears or a process completes, emit 6-8 particles radially outward from the center point.
   - Each particle at evenly-spaced angles: \`angle = (i / 8) * Math.PI * 2\`, \`dist = localFrame * 4\`, \`opacity = Math.max(0, 1 - localFrame / 10)\`.
   - Add matching \`boxShadow\` glow per particle. Run for exactly 10-12 frames for a crisp "magic completion" burst.

33. **Mirror Reflection with CSS Mask Gradient**:
   - For premium depth, render a flipped duplicate below key elements using \`transform: "scaleY(-1)"\`.
   - REQUIRED: Apply a CSS mask that fades to transparent: \`maskImage: "linear-gradient(to bottom, rgba(0,0,0,0.15), transparent)"\` / \`WebkitMaskImage\`.
   - Use reduced opacity (0.15-0.25) on the reflection. This simulates a glossy floor surface.

34. **Generation Sweep Wipe (Progressive Reveal)**:
   - To show AI generation or processing, overlay a gradient that sweeps left-to-right revealing content underneath.
   - Use: \`background: "linear-gradient(90deg, transparent \${progress * 100}%, \${bgColor}dd \${progress * 100 + 10}%, \${bgColor} 100%)"\`.
   - The 10% gradient softness at the edge prevents a harsh line. Remove the overlay entirely when \`progress > 0.98\`.

35. **interpolateColors for Time-Based Color Shifting**:
   - Use \`interpolateColors(frame, [0, 30, 60, 90], [color1, color2, color3, color1])\` from \`remotion\` to smoothly cycle accent colors over time.
   - Pipe the animated color into \`boxShadow\`, \`background\`, \`border\`, and \`textShadow\` across multiple elements for visual coherence.
   - Color cycling prevents visual fatigue in longer scenes and creates emotional arcs (warm→cool→warm).

36. **CSS 3D Wireframe Sphere (No WebGL)**:
   - Create a wireframe sphere using multiple circular \`div\` rings with \`borderRadius: "50%"\` rotated at evenly-spaced Y angles inside a \`transformStyle: "preserve-3d"\` container.
   - Two sets of rings: vertical great circles (\`rotateY(angle)\`) and horizontal latitude circles (\`rotateX(angle)\`) at \`opacity: 0.5\`.
   - Add \`noise2D\` perturbation to the container's rotation to prevent mechanical orbiting.

37. **Gradient Text via background-clip**:
   - For accent words and brand text, use: \`background: "linear-gradient(135deg, #3B82F6, #06B6D4)"; WebkitBackgroundClip: "text"; WebkitTextFillColor: "transparent"\`.
   - REQUIRED: Add padding \`0.15em 0.05em\` to prevent gradient clip edge artifacts.
   - Combine with \`filter: "drop-shadow(0 0 60px color)"\` for a glow-through-text holographic effect.

38. **Staggered Kinetic Title Card (Mixed Hierarchy)**:
   - Title cards SHOULD have each word at dramatically different sizes (28px to 280px), weights (400 to 900), and styles (italic, skewX, letter-spacing).
   - Each word gets its own spring with staggered delays (8, 18, 35, 45, 60 frames) and its own entrance direction (scale+rotation, translateX+skewX, translateY, bouncy scale).
   - This creates a choreographed "impact stack" like a movie title sequence rather than uniform text.

39. **Multi-Cursor Collaboration with Two-Speed Noise**:
   - Animate cursors from start to end positions using spring-driven interpolation.
   - REQUIRED: Use two noise speeds — large wobble (\`noise2D * 18\`) during transit (\`spr > 0.02 && spr < 0.98\`), small idle drift (\`noise2D * 3\`) when settled.
   - Add a "click" squish at arrival: \`interpolate(clickSpr, [0, 0.5, 1], [1, 0.75, 1])\` and a blurred 14px trail circle during transit.
   - Emit 3 staggered ripple rings at the landing point that expand outward and fade through peak opacity.

40. **Toast Notification with Enter/Exit Springs**:
   - Slide a toast in from the right: \`translateX(\${interpolate(spr, [0,1], [60, 0])}px)\` with spring entrance.
   - REQUIRED: Use asymmetric timing — spring for enter, linear fade for exit: \`opacity: toastSpr * interpolate(frame, [exitStart, exitEnd], [1, 0])\`.
   - Include a checkmark icon and two-line text (title + description). Show only during a specific frame window.

41. **Mini-Map Viewport Indicator (Creativly FlowDemo)**:
   - Small overview rect in a corner with dots for each node/element on the infinite canvas.
   - REQUIRED: viewport size inversely tracks zoom, matching Creativly values:
     - \`width: interpolate(camScale, [0.75, 1.45], [90, 40])\`
     - \`height: interpolate(camScale, [0.75, 1.45], [54, 24])\`
     - position can ease with zoom: \`left/top: interpolate(camScale, [0.75, 1.45], [5, 15])\` etc.
   - Active nodes: brand color + glow. Optional: show \`Math.round(camScale * 100)%\` zoom label.

### Creativly.ai brand-video camera recipes (copy these structures)

Source: creativly.ai-brand-video-remotion (FlowDemoScene / FocusedDemoScene). Prefer these over inventing weaker camera code.

**A. Dolly-out + pan keyframes (Flow Demo)**
\`\`\`ts
// Same frame stops for scale/x/y — cinematic lock
const stops = [0, 20, 55, 90, 125, 165];
const camScale = interpolate(frame, stops, [1.45, 1.25, 1.0, 0.88, 0.78, 0.75], {
  extrapolateLeft: "clamp", extrapolateRight: "clamp",
  easing: Easing.inOut(Easing.cubic),
});
const camX = interpolate(frame, stops, [120, 80, -40, -150, -220, -230], {
  extrapolateLeft: "clamp", extrapolateRight: "clamp",
  easing: Easing.inOut(Easing.cubic),
});
const camY = interpolate(frame, stops, [40, 25, -10, -40, -30, -25], {
  extrapolateLeft: "clamp", extrapolateRight: "clamp",
  easing: Easing.inOut(Easing.cubic),
});
const shakeX = noise2D("cam-sx", frame * 0.008, 0) * 3;
const shakeY = noise2D("cam-sy", 0, frame * 0.008) * 2;
// Canvas: 2400x1400, left/top 50%, transformOrigin center
// transform: translate(calc(-50% + \${camX+shakeX}px), calc(-50% + \${camY+shakeY}px)) scale(\${camScale})
\`\`\`
Tune the X/Y value arrays so the first keyframes pin the first subject and the last keyframes reveal the full layout.

**B. Handheld only (add to any static composition)**
- Multiply noise amplitude by intensity schema field (default 2–3px). Frequency ~0.008.
- Never use Math.random for shake.

**C. Rack-focus hero pop (Focused Demo)**
- Spring entrance drives both scale (slightly >1 → 1) and blur (high → 0) together.
- Remove blur filter after settle for performance.

**D. Perspective ground / stage (GridBackground-style)**
- \`perspective(1000px) rotateX(60deg) scale(2)\` on a grid plane + radial mask fade — sells “camera over a board” without WebGL.

**E. When to use which**
- Multi-step product / pipeline / architecture → **A** (canvas camera).
- Single hero product shot → **C** (+ optional B).
- Floating UI cards / badges → CSS 3D / orbital badges (#7, #49), not full canvas camera.

42. **Step Progress Indicator (Pill Dots)**:
   - Show vertical labeled steps where the active step has an expanded pill (24px wide vs 6px dot) with glow.
   - Three visual states: active (full opacity, brand color, boxShadow glow, 24px width), past (0.4 opacity, 6px), future (0.15 opacity, 6px).
   - This gives narrative structure — the viewer always knows where they are in the flow.

43. **SVG Flowing Dots Along Bezier Edges**:
   - After an edge finishes drawing, animate small dots flowing along the bezier curve path to show "data flow".
   - Evaluate cubic bezier manually: \`getBezierPoint(t)\` from control points. Three dots offset by 1/3 each: \`t = ((frame * speed + offset) % 1) * progress\`.
   - Fade dots at path endpoints: \`opacity: Math.sin(t * Math.PI)\`.

44. **Dark/Light Scene Polarity Alternation**:
   - In multi-scene compositions, ALTERNATE between dark (#050505) and light (#FAFAFA) backgrounds.
   - This creates visual breathing rhythm and prevents viewer fatigue. Each polarity change resets the eye.
   - Never use more than 3 consecutive scenes of the same polarity.

45. **Transition Type Diversity**:
   - In multi-scene compositions, NEVER use the same transition type consecutively.
   - Alternate between: \`slide\` (from-bottom, from-top, from-right), \`wipe\` (from-right, from-left), \`clockWipe\`, \`flip\` (from-right, from-left), \`fade\`.
   - Alternate between \`springTiming\` and \`linearTiming\`. Use \`LightLeak\` overlays sparingly (max 2-3 per video) at dramatic inflection points.

46. **Frosted Glassmorphism Panels**:
   - For overlay panels, toolbars, and badges: \`background: "rgba(15, 15, 17, 0.6)"; backdropFilter: "blur(12px)"\`.
   - REQUIRED: Add triple-layer boxShadow: ambient (\`0 40px 80px -20px rgba(0,0,0,0.9)\`), inset highlight (\`0 0 0 1px rgba(255,255,255,0.05) inset\`), depth (\`0 20px 40px rgba(0,0,0,0.5)\`).
   - The inset 1px white creates a glass edge shine. This transforms basic cards into macOS-quality frosted glass.

47. **Animated Number Counter with tabular-nums**:
   - Count up numbers using \`Math.floor(interpolate(frame, [start, end], [0, target], { easing: Easing.out(Easing.cubic) }))\`.
   - REQUIRED: Always use \`fontVariantNumeric: "tabular-nums"\` to prevent layout shift during counting.
   - Combine with gradient text (\`background-clip: text\`) and \`filter: drop-shadow(0 0 15px color)\` for premium data visualization.

48. **Seeded Deterministic Random (sin-hash)**:
   - For particle positions, sizes, and delays, use the GLSL hash: \`function seededRandom(seed: number) { const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); }\`.
   - This ensures identical renders across frames/runs — critical for video where randomness MUST be deterministic.
   - Never use \`Math.random()\` — it produces different values each frame.

49. **3D Orbital Badge Carousel with Z-Depth**:
   - Arrange badges/tags in elliptical orbits using polar coordinates with \`noise3D\` perturbation.
   - Map z-position to four visual properties: \`scale: interpolate(z, [-r, r], [0.4, 1.4])\`, \`opacity: interpolate(z, [-r, r], [0.08, 1])\`, \`blur: interpolate(z, [-r, r], [8, 0])\`, \`glowSize: interpolate(z, [-r, r], [0, 30])\`.
   - Use \`zIndex: Math.floor(z + 1000)\` for correct overlap. This creates true 3D depth without WebGL.

50. **Perspective Grid Ground Plane**:
   - For futuristic/tech scenes: CSS grid lines rotated into 3D with \`transform: perspective(1000px) rotateX(60deg) scale(2)\`.
   - Animate \`translateY\` for infinite scrolling effect. \`transformOrigin: "50% 0%"\` keeps the horizon stable.
   - REQUIRED: Mask with \`maskImage: "radial-gradient(circle, black 0%, transparent 80%)"\` plus a vignette overlay \`radial-gradient(transparent 0%, rgba(0,0,0,0.8) 100%)\`.

51. **Matrix Rain Character Shuffling**:
   - Swap glyphs dynamically based on a frame seed to create digital rain: \`CHARS[Math.floor(seededRandom(col + Math.floor(frame * 0.1)) * CHARS.length)]\`.
   - The \`frame * 0.1\` forces characters to shuffle at 1/10th the framerate for readable tech grit.

52. **Connection Pulse Dots**:
   - At the exact point a drawn path finishes, render a dot with continuous sine opacity: \`Math.sin(frame * 0.15) * 0.4 + 0.6\`.
   - Wrap it in a dual-layer boxShadow for a "live data" pipeline glow.

53. **Aurora Blob Breathing**:
   - For organic blobs, scale X and Y at different sine frequencies so they morph rather than just bouncing.
   - Example: \`scaleX = 1 + sin(t*0.5)*0.3\`; \`scaleY = 1 + cos(t*0.7)*0.2\`.

54. **Typewriter Pause Tension**:
   - Add artificial mid-sentence pauses in typewriter logic using a 3-phase frame count (pre-pause, hold pause, post-pause).
   - This creates dramatic tension and simulates an LLM "thinking", transforming mechanical typing into a character performance.

55. **SVG Logo Choreography**:
   - Stagger SVG children entrance by index, combining Y-offset (\`yOffset: 60→0\`), scale (\`0→1\`), and rotation (\`-90→0°\`).
   - Adding a slight rotation resolve makes logo entrances feel highly produced.

56. **Adaptive Particle Blur**:
   - Use a simple threshold for fake depth-of-field: \`filter: blur(\${p.size > 2.5 ? 1 : 0}px)\` on particles.
   - This costs almost nothing but makes large foreground particles feel closer to the lens.

57. **Math-Driven Hex Alpha Conversion**:
   - Convert 0-1 floats to hex alphas inline for CSS gradients without breaking string interpolation.
   - \`Math.floor(glowPulse * 255).toString(16).padStart(2, "0")\` appended to a hex color code.

58. **3D Grid Perspective Tilting**:
   - Tilt a 2D flex/grid array in 3D by calculating row/col offsets based on index: \`row = Math.floor(i / 3)\`, \`col = i % 3\`.
   - Apply \`rotateX(\${tiltX}deg) rotateY(\${tiltY}deg)\` inside a \`perspective(800px)\` container to simulate 3D space without WebGL.

59. **Dynamic Quadratic Beziers**:
   - Connect moving UI elements with curved lines by calculating midpoints: \`M \${start.x} \${start.y} Q \${mx} \${my} \${end.x} \${end.y}\`.
   - Never use straight lines for node connections in premium UI renders.

60. **Staggered Spring Cascades**:
   - Drive multiple springs off a single frame clock by clamping and offsetting.
   - \`spring({ frame: Math.max(0, frame - delay - i * stagger) })\` — this guarantees physics consistency while staggering lists.

61. **SVG Stroke Glowing Trails**:
   - Layer a heavily blurred \`div\` over an \`evolvePath\` SVG, matching its current coordinates.
   - Modulate the div's opacity and blur based on \`noise2D\` to create a spark traveling along a wire.

62. **Sine-Wave Color Breathing**:
   - Wrap \`frame\` in \`Math.sin(frame * speed)\` to drive \`interpolate\` or \`interpolateColors\`.
   - This creates continuous, keyframe-free pulsing for neon glows and watermark opacities.

63. **Skewed Highlight Marker**:
   - Animate a solid colored block behind text using \`transform: scaleX(progress) skewX(-10deg)\` with \`transformOrigin: "left center"\`.
   - The skew makes it feel like an organic highlighter swipe instead of a rigid UI box.

64. **Arrowhead Fade-In Threshold**:
   - Only reveal path end-markers (arrows) in the very last 8% of the draw animation.
   - \`arrowOpacity = p > 0.92 ? (p - 0.92) / 0.08 : 0\`. Revealing arrows before the line arrives looks amateurish.

65. **Triple-Frequency Particles**:
   - Give particles completely independent frequencies for X, Y, and opacity so they don't form visible loops (Lissajous patterns).
   - \`drift = sin(f*0.02)\`, \`float = cos(f*0.015)\`, \`pulse = sin(f*0.05)\`.

66. **Outline-Only Kinetic Type**:
   - Mix solid typography with hollow editorial outlines using \`color: "transparent"\` + \`WebkitTextStroke: "2px color"\`.
   - Essential for premium modern title sequences.

67. **Seconds-to-Frames Helpers**:
   - Define scene durations in seconds \`const DUR = 3.5;\` and convert inline \`Math.round(DUR * VIDEO_FPS)\`.
   - This makes the entire composition radically easier to edit and reflow.

68. **Polymorphic Type-Color Systems**:
   - Drive 15+ CSS properties (border, glow, scan line, label) off a single semantic color config (e.g., \`image=blue\`, \`audio=green\`).
   - Avoid hardcoding hex values into individual UI elements.

69. **Procedural Math Waveforms**:
   - Construct sine waves manually into an SVG \`path\` string (looping X and calculating Y via Math.sin).
   - Animate the drawing of this procedural path using \`evolvePath\` for dynamic audio equalizers without real audio data.

### Schema Description Rules (CRITICAL for content generation)

The \`description\` field in every schema property is read by the content-generation LLM when filling your plugin with real data. Write it to tell the LLM **what the field is AND how it is used in animation**, so generated values make sense visually.

Prefer motion-graphics language in schema descriptions: opening beat, build beat, connect beat, accent beat, resolve beat, background drift, camera push, parallax, trace, sweep, pulse, glow, and living motion. If an older example says "enter phase", treat that as a timing hint only, not as the creative structure.

Bad description: \`"The player's name"\`
Good description: \`"Player display name — shown as large headline, springs into position during enter phase"\`

Bad description: \`"A number"\`
Good description: \`"Stat value — animates counting up from 0 to this value over the enter phase using interpolate"\`

Bad description: \`"Background image"\`
Good description: \`"Full-bleed background image — visible throughout all phases, no animation, should be a wide scenic or stadium shot"\`

Pattern per field type:
- Text/headline: \`"<what it is> — <where it appears on screen>, <enter animation> during enter phase"\`
- Number/stat: \`"<what it is> — counts up from 0 → value using interpolate over enter phase"\`
- Image (bg): \`"<what it is> — full-bleed background, no animation, <style guidance>"\`
- Image (fg): \`"<what it is> — fades/scales in during enter phase, positioned <where>"\`
- Audio: \`"<what it is> — narrated voiceover, spoken aloud"\`
- Color: \`"<what it is> — used for <element name> color, e.g. accent bar, text highlight"\`
- Array item: \`"One entry in <array name> — rendered as <card/bar/row>, animates with stagger delay based on index"\`

### CSS Rules (CRITICAL)

- CSS transitions (\`transition: ...\`) are FORBIDDEN — they won't render correctly.
- Tailwind animation classes are FORBIDDEN.
- Use ONLY \`useCurrentFrame()\` + \`interpolate()\` / \`spring()\` for all animations.
- No \`setInterval\`, \`setTimeout\`, \`requestAnimationFrame\` — Remotion drives the clock.
`;
