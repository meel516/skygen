# Advanced Motion Graphics & Cinematic Patterns

These are the premium cinematic patterns and motion graphics rules extracted into the agent's permanent brain. They are designed to elevate Remotion video generation into professional, high-impact motion graphics.

---

### Core Motion Graphics Rules (1-69)

1. **High-End Procedural Backgrounds**:
   - FORBIDDEN: Plain solid color backgrounds.
   - REQUIRED: Use CSS `radial-gradient` mapped to `Math.sin/cos` driven by `useCurrentFrame()` to create floating "Aurora" color blobs. Or use lightweight absolute-positioned elements drifting with `noise2D` to create particle fields.

2. **Kinetic Typography (Staggered Reveals)**:
   - FORBIDDEN: Fading in whole text blocks at once.
   - REQUIRED: Split text into characters or words (using `map`). Use `spring()` with a stagger delay: `frame: Math.max(0, frame - i * stagger)`.
   - Interpolate `translateY`, `scale`, and `filter: blur()` simultaneously on each word for premium, Apple-style text reveals.

3. **Infinite Canvas / Camera Pan (Creativly FlowDemo pattern — REQUIRED for multi-node / explainer scenes)**:
   - Create a massive canvas `div` (e.g. **2400×1400**) inside `AbsoluteFill`, centered with `left/top: 50%` and `transformOrigin: "center center"`.
   - Place all nodes/UI absolutely on that canvas (not on the viewport).
   - Drive camera with multi-keyframe `interpolate` + `Easing.inOut(Easing.cubic)` on **camScale, camX, camY** together (same frame stops for all three).
   - **Creativly pull-back recipe** (tight on first element → reveal full board):
     - frames: `[0, 20, 55, 90, 125, 165]`
     - camScale: `[1.45, 1.25, 1.0, 0.88, 0.78, 0.75]` (start zoomed-in, dolly out)
     - camX / camY: multi-stage pans that track the narrative (e.g. start offset on first node, end centered on full pipeline)
   - Apply: `transform: \`translate(calc(-50% + ${camX + shakeX}px), calc(-50% + ${camY + shakeY}px)) scale(${camScale})\``
   - **Handheld**: `shakeX = noise2D("cam-sx", frame * 0.008, 0) * 3`, `shakeY = noise2D("cam-sy", 0, frame * 0.008) * 2` (subtle — never > ~4px unless intentional chaos)
   - Optional **mini-map viewport** (#41): rect size inversely tracks camScale so zoom context is readable.

4. **2.5D Browser Mockups**:
   - For UI showcases, wrap images in a macOS-style browser frame (top bar with 3 dots).
   - Apply 3D CSS transforms: `perspective: 1000px`, `rotateX`, and `rotateY` to make them float in 3D space.

5. **Node/Workflow Diagrams**:
   - Draw data flows using SVG cubic bezier paths (`<path d="M... C...">`) to connect nodes.
   - Animate data flowing between them using `strokeDasharray` and animating `strokeDashoffset` with `useCurrentFrame()`.

6. **Animated Data Counters & Progress**:
   - FORBIDDEN: Static numbers for stats or data.
   - REQUIRED: Use `Math.floor(interpolate(progress, [0, 1], [0, targetValue]))` to animate numbers ticking up.
   - REQUIRED: Animate SVG lines/charts using `evolvePath` from `@remotion/paths` over time.

7. **Staggered 3D Cards Grid**:
   - When showing a grid of elements (like templates, photos, or features), use `perspective(800px) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`.
   - Stagger the entrance of each card with `delay = i * 5` and calculate tilt directions based on their row/column position to give the grid depth.

8. **Audio / Data Waveforms**:
   - For audio or data plugins, create an array of bars `<divs>` where height is driven by `Math.sin()` and `noise2D()`.
   - Apply a floor reflection by duplicating the bars upside down with `transform: scaleY(-1)` and fading them out using `maskImage: "linear-gradient(to bottom, rgba(0,0,0,0.15), transparent)"`.

9. **3D Exploding UI Layers**:
   - When showcasing a dashboard or editor UI, wrap the layers in a container with `transformStyle: "preserve-3d"` and `rotateX("15deg")`.
   - Place different pieces of the UI in separate child layers, and animate their `translateZ` values to "explode" them apart along the Z-axis, creating a cinematic depth effect.

10. **Multiplayer / Collaboration Cursors**:
   - When showing real-time collaboration, draw SVG cursors and animate their x/y positions using `spring`.
   - REQUIRED: Add organic wobble to the cursor paths using `noise2D`.
   - REQUIRED: Draw curved SVG connecting paths between cursors using `evolvePath` to show team connectivity.

11. **Before / After Scanlines (AI Processing)**:
   - When showing an AI feature (like inpainting, upscaling, or editing), use a sweeping scanline `<div>`.
   - REQUIRED: Use `clipPath: "polygon(...)"` to separate the "before" state (e.g. with `backdropFilter: "grayscale(100%) blur(10px)"`) from the "after" state.
   - Attach small `@remotion/shapes` stars that follow the scanline and drift dynamically using `noise2D`.

12. **Node-Based Workflows (Pipelines & Graphs)**:
   - When showing a pipeline or workflow, render distinct Node components and connect them using curved SVG `<path>` edges (animating with `evolvePath`).
   - REQUIRED: Animate a cinematic camera panning and zooming across the nodes using `interpolate` on a parent container's `scale` and `translate`.

13. **Typewriter Text with Evolving Indicator**:
   - When showing AI generating text, use a `<Typewriter>` component.
   - REQUIRED: Alongside the text, animate a vertical line drawing down using `evolvePath`, accompanied by a blurred gradient glow block that acts as a highlighted cursor.

14. **Floating Camera / Recorder Overlays**:
   - When showing screen recording, presentations, or video calls, place a floating "Camera Overlay" box in the bottom right (with heavy rounded borders, `overflow: hidden`, and colored shadows).
   - Add a blinking "REC" indicator animated via `Math.sin()` and wrap it in a circular `evolvePath` ring.

15. **Card Shimmer Sweep**:
   - On cards and panels, animate a diagonal light sweep: `background: "linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.2) 50%, transparent 70%)"`.
   - Animate `transform: translateX(${shimmerX}%)` from -120% to 220% over ~35 frames to make cards feel premium and tactile.

16. **Dual Ghost Watermark Depth**:
   - For background depth, render two copies of a large italic watermark word stacked on top of each other.
   - First copy is at normal opacity (e.g. 0.06), second copy is offset slightly (e.g. `top: "48%", left: "51%"`) at 40% of the first copy's opacity, creating a parallax depth effect.

17. **Matrix Rain Background**:
   - When showing a "code", "open source", or "developer" scene, use a `<MatrixRain>` component with a dot grid (`backgroundImage: "radial-gradient(#color 1px, transparent 1px)"`) overlay.
   - Set the Matrix Rain to a very low opacity (e.g. 0.12) so it's a subtle, atmospheric background effect.

18. **Aurora Background with Breathing Glow**:
   - For outro or hero scenes, use an `<AuroraBackground>` component behind everything, then layer a `radial-gradient` centered glow on top of it.
   - Animate the glow's `scale` property using `noise2D` to make it "breathe" organically: `scale(${0.6 + 0.15 * noise2D("breathe", frame * 0.02, 0)})`.

19. **Interactive Before/After Comparison Slider**:
   - For image editing, enhancement, or preset comparisons, overlay the "Before" state using `clipPath: polygon(0 0, ${sliderPos}% 0, ${sliderPos}% 100%, 0 100%)` over the "After" state.
   - Draw a physical white vertical divider line at `left: ${sliderPos}%` with a custom floating drag handle container containing grip dots.

20. **Horizontal Speed Line Warp**:
   - To show high speed or performance, render an array of horizontal lines that move across the screen.
   - Calculate their position using frame-based modulo: `left: ((frame * speed + offset) % (width + margin)) - margin`. Blend their widths dynamically using `noise2D`.

21. **Decaying Screen Shake**:
   - During high-impact transitions or speed bursts, add camera shake to the parent container using `noise2D("shake", frame * frequency, 0) * intensity`.
   - REQUIRED: Multiply the shake by a decaying factor (e.g., `1 - progress`) so it starts intense and organically settles to zero.

22. **Connection Handles with State Glow**:
   - For node-based workflows, render precise circular connection handles at the left and right edges: `position: absolute, left/right: -6, top: "50%", transform: "translateY(-50%)", width: 12, height: 12, borderRadius: "50%"`.
   - Modulate their border glow colors based on active signals using `handleGlow` props: `boxShadow: handleGlow > 0 ? 0 0 ${12 * handleGlow}px ${color} : none`.

23. **Scanning Progress Tints**:
   - During a progress sweep, render a semi-transparent colored tint behind the sweep line covering only the completed portion: `position: absolute, top: 0, left: 0, width: ${scanLinePos}%, background: ${color}08, zIndex: 4`.

24. **Contextual Slide-Out Action Docks**:
   - When elements are selected or focused, slide out a contextual glass action toolbar from behind the element: `position: absolute, right: -52, top: "50%", transform: translateY(-50%) translateX(${10 * (1 - actionDockOpacity)}px)`.
   - Coordinate the dock's opacity and position to animate in perfect sync using spring values.

25. **Transition Series Sequence Orchestration**:
   - For multi-scene layouts, coordinate scenes using `<TransitionSeries>` from `@remotion/transitions` with standard transitions (`wipe`, `slide`, `fade`, `flip`).
   - Use spring timings like `springTiming({ config: { damping: 200 } })` for smooth, satisfying cuts.

26. **Organic Light Leak Transitions**:
   - When moving between major sections, layer a `<TransitionSeries.Overlay>` containing a `<LightLeak>` from `@remotion/light-leaks` (e.g., `<LightLeak seed={3} hueShift={50} />`) to make scene cuts feel natural, warm, and professional.

27. **Highlighter Text Reveals**:
   - Emphasize key text by rendering a background highlight container: `position: absolute, left/right: -6, zIndex: -1, transformOrigin: "left center"`.
   - Draw the highlight left-to-right using `transform: scaleX(${progress}) skewX(${skew}deg)` triggered by text timing.

28. **Outline & Micro-Drift Typography**:
   - Support outline styles for large, modern headlines: `WebkitTextStroke: "2px color", color: "transparent"`.
   - Apply a micro-noise drift (`noise2D`) to active typography elements to keep them moving subtly.

29. **Premium Easing Curves (Cinematic & Elastic)**:
   - For premium transitions, avoid browser default or generic easings.
   - REQUIRED: Use custom bezier easings: `Easing.bezier(0.22, 1, 0.36, 1)` for a smooth cinematic ramp, or `Easing.bezier(0.1, 0.9, 0.2, 1)` for a soft elastic spring-like curve.

30. **Blur-to-Sharp Rack Focus Entrance (Creativly FocusedDemo pattern)**:
   - Elements SHOULD enter with gaussian blur resolving to sharp: combine **spring entrance** with:
     - `heroScale = interpolate(spr, [0, 1], [1.12, 1])` (or 1.8→1 for punchier hero)
     - `heroBlur = interpolate(spr, [0, 1], [14, 0])` (or start ~20 for deeper rack)
   - Apply: `transform: scale(${heroScale})` + `filter: heroBlur > 0.5 ? \`blur(${heroBlur}px)\` : undefined`
   - REQUIRED: drop filter when blur ≤ 0.5 (perf). Pair with soft shadow/border so the “lens pop” reads.
   - Mimics camera rack-focus — far more cinematic than opacity-only fades.

31. **Spring-Gated Noise (Critical Polish)**:
   - When elements have post-entrance noise drift, ALWAYS multiply noise by the entrance spring value: `noise2D("badge-${i}", frame * 0.02, i) * 3 * entranceSpr`.
   - At `entranceSpr = 0` (not yet entered), noise has zero effect. At `entranceSpr = 1` (fully entered), noise is at full amplitude.
   - This prevents the visual glitch of items visibly drifting before their entrance animation completes.

32. **Sparkle Burst at Completion**:
   - When a result appears or a process completes, emit 6-8 particles radially outward from the center point.
   - Each particle at evenly-spaced angles: `angle = (i / 8) * Math.PI * 2`, `dist = localFrame * 4`, `opacity = Math.max(0, 1 - localFrame / 10)`.
   - Add matching `boxShadow` glow per particle. Run for exactly 10-12 frames for a crisp "magic completion" burst.

33. **Mirror Reflection with CSS Mask Gradient**:
   - For premium depth, render a flipped duplicate below key elements using `transform: "scaleY(-1)"`.
   - REQUIRED: Apply a CSS mask that fades to transparent: `maskImage: "linear-gradient(to bottom, rgba(0,0,0,0.15), transparent)"` / `WebkitMaskImage`.
   - Use reduced opacity (0.15-0.25) on the reflection. This simulates a glossy floor surface.

34. **Generation Sweep Wipe (Progressive Reveal)**:
   - To show AI generation or processing, overlay a gradient that sweeps left-to-right revealing content underneath.
   - Use: `background: "linear-gradient(90deg, transparent ${progress * 100}%, ${bgColor}dd ${progress * 100 + 10}%, ${bgColor} 100%)"`.
   - The 10% gradient softness at the edge prevents a harsh line. Remove the overlay entirely when `progress > 0.98`.

35. **interpolateColors for Time-Based Color Shifting**:
   - Use `interpolateColors(frame, [0, 30, 60, 90], [color1, color2, color3, color1])` from `remotion` to smoothly cycle accent colors over time.
   - Pipe the animated color into `boxShadow`, `background`, `border`, and `textShadow` across multiple elements for visual coherence.
   - Color cycling prevents visual fatigue in longer scenes and creates emotional arcs (warm→cool→warm).

36. **CSS 3D Wireframe Sphere (No WebGL)**:
   - Create a wireframe sphere using multiple circular `div` rings with `borderRadius: "50%"` rotated at evenly-spaced Y angles inside a `transformStyle: "preserve-3d"` container.
   - Two sets of rings: vertical great circles (`rotateY(angle)`) and horizontal latitude circles (`rotateX(angle)`) at `opacity: 0.5`.
   - Add `noise2D` perturbation to the container's rotation to prevent mechanical orbiting.

37. **Gradient Text via background-clip**:
   - For accent words and brand text, use: `background: "linear-gradient(135deg, #3B82F6, #06B6D4)"; WebkitBackgroundClip: "text"; WebkitTextFillColor: "transparent"`.
   - REQUIRED: Add padding `0.15em 0.05em` to prevent gradient clip edge artifacts.
   - Combine with `filter: "drop-shadow(0 0 60px color)"` for a glow-through-text holographic effect.

38. **Staggered Kinetic Title Card (Mixed Hierarchy)**:
   - Title cards SHOULD have each word at dramatically different sizes (28px to 280px), weights (400 to 900), and styles (italic, skewX, letter-spacing).
   - Each word gets its own spring with staggered delays (8, 18, 35, 45, 60 frames) and its own entrance direction (scale+rotation, translateX+skewX, translateY, bouncy scale).
   - This creates a choreographed "impact stack" like a movie title sequence rather than uniform text.

39. **Multi-Cursor Collaboration with Two-Speed Noise**:
   - Animate cursors from start to end positions using spring-driven interpolation.
   - REQUIRED: Use two noise speeds — large wobble (`noise2D * 18`) during transit (`spr > 0.02 && spr < 0.98`), small idle drift (`noise2D * 3`) when settled.
   - Add a "click" squish at arrival: `interpolate(clickSpr, [0, 0.5, 1], [1, 0.75, 1])` and a blurred 14px trail circle during transit.
   - Emit 3 staggered ripple rings at the landing point that expand outward and fade through peak opacity.

40. **Toast Notification with Enter/Exit Springs**:
   - Slide a toast in from the right: `translateX(${interpolate(spr, [0,1], [60, 0])}px)` with spring entrance.
   - REQUIRED: Use asymmetric timing — spring for enter, linear fade for exit: `opacity: toastSpr * interpolate(frame, [exitStart, exitEnd], [1, 0])`.
   - Include a checkmark icon and two-line text (title + description). Show only during a specific frame window.

41. **Mini-Map Viewport Indicator (Creativly FlowDemo)**:
   - Small overview rect in a corner with dots for each node/element on the infinite canvas.
   - REQUIRED: viewport size inversely tracks zoom, matching Creativly values:
     - `width: interpolate(camScale, [0.75, 1.45], [90, 40])`
     - `height: interpolate(camScale, [0.75, 1.45], [54, 24])`
     - position can ease with zoom: `left/top: interpolate(camScale, [0.75, 1.45], [5, 15])` etc.
   - Active nodes: brand color + glow. Optional: show `Math.round(camScale * 100)%` zoom label.

42. **Step Progress Indicator (Pill Dots)**:
   - Show vertical labeled steps where the active step has an expanded pill (24px wide vs 6px dot) with glow.
   - Three visual states: active (full opacity, brand color, boxShadow glow, 24px width), past (0.4 opacity, 6px), future (0.15 opacity, 6px).
   - This gives narrative structure — the viewer always knows where they are in the flow.

43. **SVG Flowing Dots Along Bezier Edges**:
   - After an edge finishes drawing, animate small dots flowing along the bezier curve path to show "data flow".
   - Evaluate cubic bezier manually: `getBezierPoint(t)` from control points. Three dots offset by 1/3 each: `t = ((frame * speed + offset) % 1) * progress`.
   - Fade dots at path endpoints: `opacity: Math.sin(t * Math.PI)`.

44. **Dark/Light Scene Polarity Alternation**:
   - In multi-scene compositions, ALTERNATE between dark (#050505) and light (#FAFAFA) backgrounds.
   - This creates visual breathing rhythm and prevents viewer fatigue. Each polarity change resets the eye.
   - Never use more than 3 consecutive scenes of the same polarity.

45. **Transition Type Diversity**:
   - In multi-scene compositions, NEVER use the same transition type consecutively.
   - Alternate between: `slide` (from-bottom, from-top, from-right), `wipe` (from-right, from-left), `clockWipe`, `flip` (from-right, from-left), `fade`.
   - Alternate between `springTiming` and `linearTiming`. Use `LightLeak` overlays sparingly (max 2-3 per video) at dramatic inflection points.

46. **Frosted Glassmorphism Panels**:
   - For overlay panels, toolbars, and badges: `background: "rgba(15, 15, 17, 0.6)"; backdropFilter: "blur(12px)"`.
   - REQUIRED: Add triple-layer boxShadow: ambient (`0 40px 80px -20px rgba(0,0,0,0.9)`), inset highlight (`0 0 0 1px rgba(255,255,255,0.05) inset`), depth (`0 20px 40px rgba(0,0,0,0.5)`).
   - The inset 1px white creates a glass edge shine. This transforms basic cards into macOS-quality frosted glass.

47. **Animated Number Counter with tabular-nums**:
   - Count up numbers using `Math.floor(interpolate(frame, [start, end], [0, target], { easing: Easing.out(Easing.cubic) }))`.
   - REQUIRED: Always use `fontVariantNumeric: "tabular-nums"` to prevent layout shift during counting.
   - Combine with gradient text (`background-clip: text`) and `filter: drop-shadow(0 0 15px color)` for premium data visualization.

48. **Seeded Deterministic Random (sin-hash)**:
   - For particle positions, sizes, and delays, use the GLSL hash: `function seededRandom(seed: number) { const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); }`.
   - This ensures identical renders across frames/runs — critical for video where randomness MUST be deterministic.
   - Never use `Math.random()` — it produces different values each frame.

49. **3D Orbital Badge Carousel with Z-Depth**:
   - Arrange badges/tags in elliptical orbits using polar coordinates with `noise3D` perturbation.
   - Map z-position to four visual properties: `scale: interpolate(z, [-r, r], [0.4, 1.4])`, `opacity: interpolate(z, [-r, r], [0.08, 1])`, `blur: interpolate(z, [-r, r], [8, 0])`, `glowSize: interpolate(z, [-r, r], [0, 30])`.
   - Use `zIndex: Math.floor(z + 1000)` for correct overlap. This creates true 3D depth without WebGL.

50. **Perspective Grid Ground Plane**:
   - For futuristic/tech scenes: CSS grid lines rotated into 3D with `transform: perspective(1000px) rotateX(60deg) scale(2)`.
   - Animate `translateY` for infinite scrolling effect. `transformOrigin: "50% 0%"` keeps the horizon stable.
   - REQUIRED: Mask with `maskImage: "radial-gradient(circle, black 0%, transparent 80%)"` plus a vignette overlay `radial-gradient(transparent 0%, rgba(0,0,0,0.8) 100%)`.

51. **Matrix Rain Character Shuffling**:
   - Swap glyphs dynamically based on a frame seed to create digital rain: `CHARS[Math.floor(seededRandom(col + Math.floor(frame * 0.1)) * CHARS.length)]`.
   - The `frame * 0.1` forces characters to shuffle at 1/10th the framerate for readable tech grit.

52. **Connection Pulse Dots**:
   - At the exact point a drawn path finishes, render a dot with continuous sine opacity: `Math.sin(frame * 0.15) * 0.4 + 0.6`.
   - Wrap it in a dual-layer boxShadow for a "live data" pipeline glow.

53. **Aurora Blob Breathing**:
   - For organic blobs, scale X and Y at different sine frequencies so they morph rather than just bouncing.
   - Example: `scaleX = 1 + sin(t*0.5)*0.3`; `scaleY = 1 + cos(t*0.7)*0.2`.

54. **Typewriter Pause Tension**:
   - Add artificial mid-sentence pauses in typewriter logic using a 3-phase frame count (pre-pause, hold pause, post-pause).
   - This creates dramatic tension and simulates an LLM "thinking", transforming mechanical typing into a character performance.

55. **SVG Logo Choreography**:
   - Stagger SVG children entrance by index, combining Y-offset (`yOffset: 60→0`), scale (`0→1`), and rotation (`-90→0°`).
   - Adding a slight rotation resolve makes logo entrances feel highly produced.

56. **Adaptive Particle Blur**:
   - Use a simple threshold for fake depth-of-field: `filter: blur(${p.size > 2.5 ? 1 : 0}px)` on particles.
   - This costs almost nothing but makes large foreground particles feel closer to the lens.

57. **Math-Driven Hex Alpha Conversion**:
   - Convert 0-1 floats to hex alphas inline for CSS gradients without breaking string interpolation.
   - `Math.floor(glowPulse * 255).toString(16).padStart(2, "0")` appended to a hex color code.

58. **3D Grid Perspective Tilting**:
   - Tilt a 2D flex/grid array in 3D by calculating row/col offsets based on index: `row = Math.floor(i / 3)`, `col = i % 3`.
   - Apply `rotateX(${tiltX}deg) rotateY(${tiltY}deg)` inside a `perspective(800px)` container to simulate 3D space without WebGL.

59. **Dynamic Quadratic Beziers**:
   - Connect moving UI elements with curved lines by calculating midpoints: `M ${start.x} ${start.y} Q ${mx} ${my} ${end.x} ${end.y}`.
   - Never use straight lines for node connections in premium UI renders.

60. **Staggered Spring Cascades**:
   - Drive multiple springs off a single frame clock by clamping and offsetting.
   - `spring({ frame: Math.max(0, frame - delay - i * stagger) })` — this guarantees physics consistency while staggering lists.

61. **SVG Stroke Glowing Trails**:
   - Layer a heavily blurred `div` over an `evolvePath` SVG, matching its current coordinates.
   - Modulate the div's opacity and blur based on `noise2D` to create a spark traveling along a wire.

62. **Sine-Wave Color Breathing**:
   - Wrap `frame` in `Math.sin(frame * speed)` to drive `interpolate` or `interpolateColors`.
   - This creates continuous, keyframe-free pulsing for neon glows and watermark opacities.

63. **Skewed Highlight Marker**:
   - Animate a solid colored block behind text using `transform: scaleX(progress) skewX(-10deg)` with `transformOrigin: "left center"`.
   - The skew makes it feel like an organic highlighter swipe instead of a rigid UI box.

64. **Arrowhead Fade-In Threshold**:
   - Only reveal path end-markers (arrows) in the very last 8% of the draw animation.
   - `arrowOpacity = p > 0.92 ? (p - 0.92) / 0.08 : 0`. Revealing arrows before the line arrives looks amateurish.

65. **Triple-Frequency Particles**:
   - Give particles completely independent frequencies for X, Y, and opacity so they don't form visible loops (Lissajous patterns).
   - `drift = sin(f*0.02)`, `float = cos(f*0.015)`, `pulse = sin(f*0.05)`.

66. **Outline-Only Kinetic Type**:
   - Mix solid typography with hollow editorial outlines using `color: "transparent"` + `WebkitTextStroke: "2px color"`.
   - Essential for premium modern title sequences.

67. **Seconds-to-Frames Helpers**:
   - Define scene durations in seconds `const DUR = 3.5;` and convert inline `Math.round(DUR * VIDEO_FPS)`.
   - This makes the entire composition radically easier to edit and reflow.

68. **Polymorphic Type-Color Systems**:
   - Drive 15+ CSS properties (border, glow, scan line, label) off a single semantic color config (e.g., `image=blue`, `audio=green`).
   - Avoid hardcoding hex values into individual UI elements.

69. **Procedural Math Waveforms**:
   - Construct sine waves manually into an SVG `path` string (looping X and calculating Y via Math.sin).
   - Animate the drawing of this procedural path using `evolvePath` for dynamic audio equalizers without real audio data.

---

### Creativly.ai Brand-Video Camera Recipes

Prefer these structures over inventing weaker camera code.

**A. Dolly-out + pan keyframes (Flow Demo)**
```ts
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
// transform: translate(calc(-50% + ${camX+shakeX}px), calc(-50% + ${camY+shakeY}px)) scale(${camScale})
```
Tune the X/Y value arrays so the first keyframes pin the first subject and the last keyframes reveal the full layout.

**B. Handheld only (add to any static composition)**
- Multiply noise amplitude by intensity schema field (default 2–3px). Frequency ~0.008.
- Never use `Math.random` for shake.

**C. Rack-focus hero pop (Focused Demo)**
- Spring entrance drives both scale (slightly >1 → 1) and blur (high → 0) together.
- Remove blur filter after settle for performance.

**D. Perspective ground / stage (GridBackground-style)**
- `perspective(1000px) rotateX(60deg) scale(2)` on a grid plane + radial mask fade — sells “camera over a board” without WebGL.

**E. When to use which**
- Multi-step product / pipeline / architecture → **A** (canvas camera).
- Single hero product shot → **C** (+ optional B).
- Floating UI cards / badges → CSS 3D / orbital badges (#49), not full canvas camera.

---

### Schema Description Rules (CRITICAL for content generation)

The `description` field in every schema property is read by the content-generation LLM when filling your plugin with real data. Write it to tell the LLM **what the field is AND how it is used in animation**, so generated values make sense visually.

Prefer motion-graphics language in schema descriptions: opening beat, build beat, connect beat, accent beat, resolve beat, background drift, camera push, parallax, trace, sweep, pulse, glow, and living motion. If an older example says "enter phase", treat that as a timing hint only, not as the creative structure.

Bad description: `"The player's name"`
Good description: `"Player display name — shown as large headline, springs into position during enter phase"`

Bad description: `"A number"`
Good description: `"Stat value — animates counting up from 0 to this value over the enter phase using interpolate"`

Bad description: `"Background image"`
Good description: `"Full-bleed background image — visible throughout all phases, no animation, should be a wide scenic or stadium shot"`

Pattern per field type:
- Text/headline: `"<what it is> — <where it appears on screen>, <enter animation> during enter phase"`
- Number/stat: `"<what it is> — counts up from 0 → value using interpolate over enter phase"`
- Image (bg): `"<what it is> — full-bleed background, no animation, <style guidance>"`
- Image (fg): `"<what it is> — fades/scales in during enter phase, positioned <where>"`
- Audio: `"<what it is> — narrated voiceover, spoken aloud"`
- Color: `"<what it is> — used for <element name> color, e.g. accent bar, text highlight"`
- Array item: `"One entry in <array name> — rendered as <card/bar/row>, animates with stagger delay based on index"`

### CSS Rules (CRITICAL)

- CSS transitions (`transition: ...`) are FORBIDDEN — they won't render correctly.
- Tailwind animation classes are FORBIDDEN.
- Use ONLY `useCurrentFrame()` + `interpolate()` / `spring()` for all animations.
- No `setInterval`, `setTimeout`, `requestAnimationFrame` — Remotion drives the clock.
